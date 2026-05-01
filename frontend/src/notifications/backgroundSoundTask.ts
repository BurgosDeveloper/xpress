import * as TaskManager from "expo-task-manager";
import { handleIncomingSoundEventFromTask } from "./incoming";

export const BACKGROUND_NOTIFICATION_TASK = "BACKGROUND_NOTIFICATION_TASK";

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) return;
  await handleIncomingSoundEventFromTask(data);
});
