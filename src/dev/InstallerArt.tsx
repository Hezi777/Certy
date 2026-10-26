import { Mascot } from '@/mascot/Mascot'

const NAVY = 'linear-gradient(165deg, oklch(0.3 0.05 238), oklch(0.17 0.03 250))'
const CYAN = 'oklch(0.78 0.14 212)'
const DEEP = 'oklch(0.2 0.03 245)'

/**
 * Dev-only: Windows installer artwork at the exact pixel sizes NSIS and WiX require
 * (open /#installer-art; exported to BMP by the build script). Text-free areas are left
 * where the installers draw their own copy.
 */
export function InstallerArt() {
  document.documentElement.style.background = '#fff'
  document.body.style.background = '#fff'
  const glow = 'radial-gradient(60% 45% at 50% 38%, oklch(0.78 0.14 212 / 0.35), transparent 70%)'
  return (
    <div className="flex flex-col items-start gap-6 p-6 font-sans">
      {/* NSIS welcome/finish sidebar: 164×314, art only */}
      <div id="nsis-sidebar" className="relative overflow-hidden" style={{ width: 164, height: 314, background: NAVY }}>
        <div className="absolute inset-0" style={{ background: glow }} />
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 58 }}>
          <Mascot size={150} color={CYAN} paper={DEEP} frozenAt={2.4} />
        </div>
        <p className="absolute inset-x-0 text-center text-[22px] font-semibold tracking-tight text-white" style={{ top: 222 }}>
          Certy
        </p>
        <p className="absolute inset-x-0 text-center text-[11px] text-white/60" style={{ top: 252 }}>
          Tokens &amp; certificates,
          <br />
          never expired.
        </p>
      </div>

      {/* NSIS inner-page header: 150×57, sits top-right on white */}
      <div id="nsis-header" className="relative flex items-center justify-end gap-2 bg-white pr-3" style={{ width: 150, height: 57 }}>
        <span className="text-[15px] font-semibold tracking-tight" style={{ color: DEEP }}>
          Certy
        </span>
        <Mascot size={52} color={CYAN} paper={DEEP} frozenAt={2.4} />
      </div>

      {/* WiX welcome/finish dialog: 493×312; WiX writes its text on the right, white area */}
      <div id="wix-dialog" className="relative flex bg-white" style={{ width: 493, height: 312 }}>
        <div className="relative overflow-hidden" style={{ width: 164, height: 312, background: NAVY }}>
          <div className="absolute inset-0" style={{ background: glow }} />
          <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 56 }}>
            <Mascot size={150} color={CYAN} paper={DEEP} frozenAt={2.4} />
          </div>
          <p className="absolute inset-x-0 text-center text-[22px] font-semibold tracking-tight text-white" style={{ top: 220 }}>
            Certy
          </p>
        </div>
      </div>

      {/* WiX banner: 493×58; WiX writes the page title on the left */}
      <div id="wix-banner" className="relative flex items-center justify-end bg-white pr-4" style={{ width: 493, height: 58 }}>
        <Mascot size={54} color={CYAN} paper={DEEP} frozenAt={2.4} />
      </div>
    </div>
  )
}
