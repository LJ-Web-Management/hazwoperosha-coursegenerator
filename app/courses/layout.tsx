import TopBar from "@/components/TopBar";

export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <TopBar />
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
