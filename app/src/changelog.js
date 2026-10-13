// Newest first. Add a new entry (and bump VERSION in config.js) with every release.
export const CHANGELOG = [
  {
    version: "1.3.2",
    date: "October 12, 2026",
    title: "Updates arrive on their own",
    items: [
      "Ever After checks for a new version whenever you open it or come back to it, and updates itself.",
      "After an update, a note at the top tells you which version you're on.",
      "The PIN keypad sound picker in Settings always shows.",
    ],
  },
  {
    version: "1.3.1",
    date: "October 12, 2026",
    title: "Gentler keypad, higher PIN pad",
    items: [
      "The PIN keypad has a soft, rounded tap sound instead of a sharp tick.",
      "Pick the keypad sound you like in Settings: Soft, Chime (notes that climb with each digit) or Droplet.",
      "All other sounds are back to how they were in 1.2.0.",
      "The PIN pad sits higher on the screen when you sign in or change your PIN.",
    ],
  },
  {
    version: "1.3.0",
    date: "October 12, 2026",
    title: "Steadier screens and a crisper keypad",
    items: [
      "The app checks how iOS is laying out the bottom of the screen every time it changes, so nothing hides behind the bottom strip.",
      "Sign-in and the other pop-ups sit at the same comfortable height on every layout.",
      "Swiping no longer drags the whole app; lists and pop-ups bounce on their own.",
      "Pull any pop-up down from anywhere to close it once its content is at the top.",
      "Scrolling a list no longer clicks or ripples the row your finger started on.",
      "New keypad and button sounds: short, crisp ticks instead of beeps.",
    ],
  },
  {
    version: "1.2.0",
    date: "October 12, 2026",
    title: "Faster PIN pad and clearer sounds",
    items: [
      "PIN keys register the instant you touch them, with a click and a pop on each dot.",
      "Louder, crisper sounds, plus a Settings switch to hear them even when your iPhone is on silent.",
      "The current month now sits centered in the month picker.",
      "The bottom of the screen blends into the strip iOS 26 reserves for home-screen apps.",
      "The background holds still behind pop-ups and lists, so scrolling and taps stay smooth.",
    ],
  },
  {
    version: "1.1.0",
    date: "October 12, 2026",
    title: "Smoother and snappier",
    items: [
      "Buttons always respond now, even right after switching screens.",
      "Soft click sounds and light haptic taps, with a gentle pulse wherever you tap. Turn them off in Settings.",
      "Totals count smoothly to the exact amount, and bills glide into Paid after you check them off.",
      "Changes from either phone show up live, and due dates roll over at midnight on their own.",
      "Every screen adapts from small iPhones to tablets, and Bills gets a two-column view on a computer.",
    ],
  },
  {
    version: "1.0.0",
    date: "October 12, 2026",
    title: "Ever After is here",
    items: [
      "Sign in with your own 6-digit PIN on devices you've set up with your household key.",
      "Nick's and Courtney's bills in one place, sorted by due date, with a filter for each of you or both.",
      "Check bills off month by month. Autopay bills check themselves off on their due date.",
      "See what's left to pay this month and what's still owed on loans and cards.",
      "Pay-site shortcuts and saved logins, encrypted and visible only to the bill's owner.",
      "Reminders at 8 AM: a few days before, on the due date, and every day a bill is late.",
      "Auto-lock, trusted-device list, and PIN changes in Settings.",
      "Seasonal looks for holidays, all of October, and winter.",
    ],
  },
];
