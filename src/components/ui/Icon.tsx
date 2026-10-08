// Iconos SVG en línea (sin dependencias externas)
type Name =
  | "whatsapp" | "search" | "bed" | "bath" | "car" | "area" | "pin" | "heart" | "share" | "flag" | "calendar"
  | "chat" | "info" | "home" | "key" | "building" | "tools" | "doc" | "scale" | "phone" | "mail" | "check" | "menu" | "user";

const paths: Record<Name, string> = {
  whatsapp: "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.2.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.2.1.7-.2 1.4z",
  search: "M10.5 3a7.5 7.5 0 0 1 6 12l4.3 4.3-1.5 1.5-4.3-4.3A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z",
  bed: "M3 6h2v6h14a2 2 0 0 1 2 2v5h-2v-2H5v2H3V6zm6 1a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm4 1h4a3 3 0 0 1 3 3H13V8z",
  bath: "M7 4a3 3 0 0 1 3 3H8a1 1 0 0 0-2 0v5h15v2a5 5 0 0 1-3 4.6V21h-2v-2H8v2H6v-2.4A5 5 0 0 1 3 14v-2h1V7a3 3 0 0 1 3-3z",
  car: "M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11a2 2 0 0 1 2 2v5h-2v2h-2v-2H7v2H5v-2H3v-5a2 2 0 0 1 2-2zm2.1 0h9.8l-1.2-3.5H8.3L7.1 11zM6.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
  area: "M3 3h6v2H6.4l4 4-1.4 1.4-4-4V9H3V3zm12 0h6v6h-2V6.4l-4 4L13.6 9l4-4H15V3zM3 15h2v2.6l4-4 1.4 1.4-4 4H9v2H3v-6zm16 0h2v6h-6v-2h2.6l-4-4 1.4-1.4 4 4V15z",
  pin: "M12 2a7 7 0 0 1 7 7c0 5.2-7 13-7 13S5 14.2 5 9a7 7 0 0 1 7-7zm0 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  heart: "M12 21s-7.5-4.6-9.3-9.2C1.5 8.6 3.6 5 7 5c2 0 3.3 1.1 5 3 1.7-1.9 3-3 5-3 3.4 0 5.5 3.6 4.3 6.8C19.5 16.4 12 21 12 21z",
  share: "M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1z",
  flag: "M5 3h2v1h11l-2 4.5L18 13H7v8H5V3z",
  calendar: "M7 2h2v2h6V2h2v2h3v17H4V4h3V2zm11 8H6v9h12v-9z",
  chat: "M4 4h16v12H8l-4 4V4zm4 5v2h8V9H8z",
  info: "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 8v7h2v-7h-2zm0-4v2h2V6h-2z",
  home: "M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3l9-8z",
  key: "M7 14a5 5 0 1 1 4.6-7H22v4h-2v3h-3v-3h-5.4A5 5 0 0 1 7 14zm0-3a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  building: "M4 21V3h11v6h5v12h-7v-4h-2v4H4zm3-15v2h2V6H7zm4 0v2h2V6h-2zm-4 4v2h2v-2H7zm4 0v2h2v-2h-2zm-4 4v2h2v-2H7zm9-2v2h2v-2h-2zm0 4v2h2v-2h-2z",
  tools: "M21 7.5l-3.3 3.3-2.5-2.5 3.3-3.3A5 5 0 0 0 12 11l-8 8 2 2 8-8a5 5 0 0 0 7-5.5z",
  doc: "M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM8 12v2h8v-2H8zm0 4v2h8v-2H8z",
  scale: "M11 3h2v2h6l-3 7a3.5 3.5 0 0 0 7 0l-3-7h-1V3h-6v16h4v2H7v-2h4V5H5L2 12a3.5 3.5 0 0 0 7 0L6 5h5V3z",
  phone: "M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z",
  mail: "M3 5h18v14H3V5zm2 2v.5l7 4.5 7-4.5V7H5zm14 2.8l-7 4.5-7-4.5V17h14V9.8z",
  check: "M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5L9 16.2z",
  menu: "M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z",
  user: "M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5z",
};

export function Icon({ name, size = 20, title }: { name: Name; size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title ? <title>{title}</title> : null}
      <path d={paths[name]} />
    </svg>
  );
}
