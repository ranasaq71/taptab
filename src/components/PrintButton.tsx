"use client";
export default function PrintButton({ label = "Print QR sheet" }: { label?: string }) {
  return <button className="btn no-print" onClick={() => window.print()}>{label}</button>;
}
