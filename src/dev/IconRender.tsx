import { Mascot } from '@/mascot/Mascot'

/** Dev-only: renders the app icon (the character itself, transparent) at 1024px for `pnpm tauri icon` (open /#icon). */
export function IconRender() {
  // transparent page so the icon exports with alpha
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
  return (
    <div id="icon" className="relative overflow-hidden" style={{ width: 1024, height: 1024 }}>
      {/* the seal spans 212 of the 316-unit viewBox; 1282px puts it at ~84% of the canvas,
          the padding Windows icons use so it sits level with other taskbar icons */}
      <div className="absolute" style={{ left: -129, top: -129 }}>
        {/* dark eyes instead of see-through holes, so the face reads on any taskbar */}
        <Mascot size={1282} color="oklch(0.78 0.14 212)" paper="oklch(0.2 0.03 245)" frozenAt={2.4} />
      </div>
    </div>
  )
}
