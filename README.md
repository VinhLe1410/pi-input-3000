# Pi Input 3000

**A riced up version for the user input section to make you feel like you're in Los Almos or Las Vegas or anything I don't even know**

https://github.com/user-attachments/assets/26a42a07-b4f0-4419-ac40-c9c7be68c181

## Feature list:

1. **BIG FEATURE**: OpenCode-alike UI (props to [`pi-zentui`](https://github.com/lmilojevicc/pi-zentui) for the initial inspiration, and, of course, [`OpenCode`](https://github.com/anomalyco/opencode)), without overflowing into user's clipboard (by using ANSI-colored spaces instead of actual ASCII character)
2. **BIG FEATURE**: Animated loading state with "potentially insulting" whimsical user messages while the agent is working
3. **LESS BIG FEATURE**: Proper badges for displaying model, thinking effort, and usage quota (props to [this Pi Coding Agent post](https://www.reddit.com/r/PiCodingAgent/comments/1tyys3b/this_ones_mine/), made by u/monoceros-rex)
4. **LESS BIG FEATURE**: Codex usage quota, easily removable by deleting [`features/usage-quota/`](features/usage-quota/) and remove import in [`index.ts`](index.ts)
