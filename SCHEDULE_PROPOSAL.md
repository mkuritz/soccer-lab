# Soccer Hub overnight: proposed sl-scheduler entries (NOT enabled)
{ repo: "soccer-lab", wf: "overnight.yml", inputs: {}, at: [T(3, 15)], days: ALL, gap: 120, why: "Soccer Hub overnight prune + rebuild + recaps", label: "3:15 AM ET daily" },
{ repo: "soccer-lab", wf: "overnight.yml", inputs: {}, at: [T(5, 15)], days: ALL, gap: 90, why: "Soccer Hub overnight backup", label: "5:15 AM ET daily (backup)" },
Also proposed: drop the 11:40 AM ET "daily backup" cron in update.yml (midday rebuild). Match-window crons stay for live scores.
