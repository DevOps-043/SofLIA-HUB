import { CheckIcon, DocumentIcon, RefreshIcon, ToolsIcon } from "../ui/Icons";
import type { ProjectSection } from "./types";

/** Misma familia SVG de trazo que Sidebar, ChatItem y SidebarNavTools. */
export function ProjectGlyph({
  name,
  size = 18,
}: {
  name: ProjectSection | "browser" | "folder" | "back" | "plus";
  size?: number;
}) {
  if (name === "summary" || name === "files")
    return <DocumentIcon size={size} />;
  if (name === "tasks") return <CheckIcon size={size} />;
  if (name === "cycles") return <RefreshIcon size={size} />;
  if (name === "teams") return <ToolsIcon size={size} />;
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {(name === "browser" || name === "web") && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3.6 9h16.8M3.6 15h16.8M12 3c2.1 2.45 3.2 5.45 3.2 9S14.1 18.55 12 21M12 3C9.9 5.45 8.8 8.45 8.8 12S9.9 18.55 12 21" />
        </>
      )}
      {(name === "chat" || name === "chats") && (
        <path d="M8.625 20.25c.682 0 1.336-.07 1.96-.2A9.4 9.4 0 0012 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.12.874 4.054 2.31 5.515L4.5 21l4.125-.75z" />
      )}
      {name === "folder" && (
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      )}
      {name === "back" && <path d="m14 6-6 6 6 6M8 12h12" />}
      {name === "plus" && <path d="M12 5v14M5 12h14" />}
      {name === "milestones" && (
        <path d="M5 21V3m0 1c5-3 9 3 14 0v10c-5 3-9-3-14 0" />
      )}
      {name === "metrics" && <path d="M5 20V10m7 10V4m7 16V7" />}
      {name === "activity" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      )}
    </svg>
  );
}
