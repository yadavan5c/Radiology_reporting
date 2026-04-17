import { seedDemoData } from "./src/lib/seedEngine.js";

seedDemoData(console.log).then(console.log).catch(console.error);
