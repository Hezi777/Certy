//! Proves the person at the keyboard is the signed-in Windows user before a secret is shown.
//! Windows Hello when it's set up (PIN, fingerprint, face); otherwise the Windows Security
//! prompt, which accepts the account password or a smart card + PIN — the same prompt
//! browsers use before revealing a saved password.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
#[cfg_attr(not(windows), allow(dead_code))] // Hello/Windows only exist on Windows builds
pub enum Method {
    /// Windows Hello: PIN, fingerprint or face
    Hello,
    /// Windows Security prompt: password or smart card
    Windows,
    /// Not on Windows (development builds): no prompt
    None,
}

#[cfg(windows)]
pub fn method() -> Method {
    if imp::hello_available() {
        Method::Hello
    } else {
        Method::Windows
    }
}

#[cfg(not(windows))]
pub fn method() -> Method {
    Method::None
}

/// Blocks until the user answers the prompt. `Ok(false)` means cancelled or not verified.
#[cfg(windows)]
pub fn verify(hwnd: isize, reason: &str) -> anyhow::Result<bool> {
    imp::init_com();
    if imp::hello_available() {
        imp::hello(hwnd, reason)
    } else {
        imp::credentials(hwnd, reason)
    }
}

#[cfg(not(windows))]
pub fn verify(_hwnd: isize, _reason: &str) -> anyhow::Result<bool> {
    Ok(true)
}

#[cfg(windows)]
mod imp {
    use std::ffi::c_void;
    use windows::core::{factory, HSTRING, PCWSTR, PWSTR};
    use windows::Security::Credentials::UI::{
        UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
    };
    use windows::Win32::Foundation::{CloseHandle, ERROR_ACCOUNT_RESTRICTION, HANDLE, HWND};
    use windows::Win32::Security::Credentials::{
        CredUIParseUserNameW, CredUIPromptForWindowsCredentialsW, CredUnPackAuthenticationBufferW, CREDUIWIN_ENUMERATE_CURRENT_USER,
        CREDUI_INFOW, CRED_PACK_FLAGS,
    };
    use windows::Win32::Security::{LogonUserW, LOGON32_LOGON_INTERACTIVE, LOGON32_PROVIDER_DEFAULT};
    use windows::Win32::System::Com::{CoInitializeEx, CoTaskMemFree, COINIT_MULTITHREADED};
    use windows::Win32::System::WinRT::IUserConsentVerifierInterop;
    use windows_future::IAsyncOperation;

    pub fn init_com() {
        // the prompt runs on a worker thread; already-initialised is fine
        let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
    }

    pub fn hello_available() -> bool {
        UserConsentVerifier::CheckAvailabilityAsync()
            .and_then(|op| op.get())
            .map(|a| a == UserConsentVerifierAvailability::Available)
            .unwrap_or(false)
    }

    pub fn hello(hwnd: isize, reason: &str) -> anyhow::Result<bool> {
        // the interop variant parents the Hello dialog to our window instead of opening behind it
        let interop = factory::<UserConsentVerifier, IUserConsentVerifierInterop>()?;
        let op: IAsyncOperation<UserConsentVerificationResult> =
            unsafe { interop.RequestVerificationForWindowAsync(HWND(hwnd as *mut c_void), &HSTRING::from(reason))? };
        Ok(op.get()? == UserConsentVerificationResult::Verified)
    }

    pub fn credentials(hwnd: isize, reason: &str) -> anyhow::Result<bool> {
        let caption = HSTRING::from("Certy");
        let message = HSTRING::from(reason);
        let info = CREDUI_INFOW {
            cbSize: std::mem::size_of::<CREDUI_INFOW>() as u32,
            hwndParent: HWND(hwnd as *mut c_void),
            pszMessageText: PCWSTR(message.as_ptr()),
            pszCaptionText: PCWSTR(caption.as_ptr()),
            hbmBanner: Default::default(),
        };
        let mut package = 0u32;
        let mut out: *mut c_void = std::ptr::null_mut();
        let mut out_size = 0u32;
        let rc = unsafe {
            CredUIPromptForWindowsCredentialsW(
                Some(&info),
                0,
                &mut package,
                None,
                0,
                &mut out,
                &mut out_size,
                None,
                CREDUIWIN_ENUMERATE_CURRENT_USER,
            )
        };
        if rc != 0 {
            return Ok(false); // ERROR_CANCELLED and friends
        }

        let mut user = [0u16; 514];
        let mut domain = [0u16; 338];
        let mut pass = [0u16; 514];
        let (mut ul, mut dl, mut pl) = (user.len() as u32, domain.len() as u32, pass.len() as u32);
        let unpacked = unsafe {
            CredUnPackAuthenticationBufferW(
                CRED_PACK_FLAGS(0),
                out,
                out_size,
                Some(PWSTR(user.as_mut_ptr())),
                &mut ul,
                Some(PWSTR(domain.as_mut_ptr())),
                Some(&mut dl),
                Some(PWSTR(pass.as_mut_ptr())),
                &mut pl,
            )
        };
        // the buffer holds the password: wipe it before freeing
        unsafe {
            std::ptr::write_bytes(out as *mut u8, 0, out_size as usize);
            CoTaskMemFree(Some(out));
        }
        if unpacked.is_err() {
            pass.fill(0);
            return Ok(false);
        }

        // "DOMAIN\user" must be split for LogonUser; a smart card's marshaled credential
        // doesn't parse and is passed through as-is, which LogonUser accepts
        let mut name = [0u16; 514];
        let mut dom = [0u16; 338];
        let parsed = unsafe { CredUIParseUserNameW(PCWSTR(user.as_ptr()), &mut name, &mut dom) }.0 == 0;
        let (u, d) = if parsed { (name.as_ptr(), dom.as_ptr()) } else { (user.as_ptr(), domain.as_ptr()) };

        let mut token = HANDLE::default();
        let res = unsafe {
            LogonUserW(PCWSTR(u), PCWSTR(d), PCWSTR(pass.as_ptr()), LOGON32_LOGON_INTERACTIVE, LOGON32_PROVIDER_DEFAULT, &mut token)
        };
        pass.fill(0);
        match res {
            Ok(()) => {
                let _ = unsafe { CloseHandle(token) };
                Ok(true)
            }
            // an account with a blank password can't log on interactively, but it was the right one
            Err(e) if e.code() == ERROR_ACCOUNT_RESTRICTION.to_hresult() => Ok(true),
            Err(_) => Ok(false),
        }
    }
}
