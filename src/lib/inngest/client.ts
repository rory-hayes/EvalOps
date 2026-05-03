import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "evalops-copilot",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
