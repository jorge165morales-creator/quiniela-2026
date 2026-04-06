import { flagUrl } from "@/lib/flags";

export default function FlagImg({ team, h = 16 }: { team: string; h?: number }) {
  const url = flagUrl(team);
  if (!url) return <span className="text-sm leading-none">⚽</span>;
  return (
    <img
      src={url}
      alt={team}
      className="inline-block rounded-[2px] object-cover shrink-0"
      style={{ height: h, width: "auto" }}
    />
  );
}
