import launchesData from "@/data/launches.json";

export type LaunchEventItem = {
  title: string;
  date: string;
  startTime?: string;
  platform: string;
  url: string;
  heat: number;
};

export function fetchLaunchEvents(): LaunchEventItem[] {
  const now = new Date();
  const twoWeeksAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
  const oneYearLater = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  return (launchesData as LaunchEventItem[])
    .filter((item) => {
      const eventDate = new Date(item.startTime ?? item.date);
      return eventDate >= twoWeeksAgo && eventDate <= oneYearLater;
    })
    .sort((a, b) => (a.startTime ?? a.date).localeCompare(b.startTime ?? b.date));
}
