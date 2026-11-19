import { ImageResponse } from "next/og";

// Preview card for links shared in messengers and social networks (1200×630).
export const alt = "Re:meeet — make time together last longer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const stroke = { fill: "none", strokeWidth: 4.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: "#0F172A", padding: "0 90px" }}>
        <svg width="300" height="300" viewBox="-9.46 -4 72 72">
          <path {...stroke} stroke="#7692FF" opacity="0.83" d="M-1.43 25.31L6 32L-1.43 38.69" />
          <path {...stroke} stroke="#7692FF" d="M8.07 25.31L15.5 32L8.07 38.69" />
          <path {...stroke} stroke="#FFD150" opacity="0.83" d="M54.51 6.39L45 9.48L42.92 -0.3" />
          <path {...stroke} stroke="#FFD150" d="M49.76 14.62L40.25 17.71L38.17 7.93" />
          <path {...stroke} stroke="#46C5B7" opacity="0.83" d="M42.92 64.3L45 54.52L54.51 57.61" />
          <path {...stroke} stroke="#46C5B7" d="M38.17 56.07L40.25 46.29L49.76 49.38" />
          <path fill="#fff" transform="translate(32 32) scale(1.25)" d="M0-10C.55-2.7 2.7-.55 10 0C2.7.55.55 2.7 0 10C-.55 2.7-2.7.55-10 0C-2.7-.55-.55-2.7 0-10Z" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 60 }}>
          <div style={{ fontSize: 120, fontWeight: 700, color: "#fff", letterSpacing: -3 }}>Re:meeet</div>
          <div style={{ fontSize: 44, color: "#CBD5E1", marginTop: 10 }}>Make time together last longer</div>
        </div>
      </div>
    ),
    size,
  );
}
