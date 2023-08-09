import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { TodoistApi } from "@doist/todoist-api-typescript";
import { env } from "fpp/env.mjs";

export type Todo = {
  title: string;
  description: string;
};

export const roadmapRouter = createTRPCRouter({
  getRoadmap: publicProcedure.query<{
    todo: Todo[];
    inProgress: Todo[];
    done: Todo[];
  }>(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const api = new TodoistApi(env.TODOIST_SECRET);
      const tasks = await api.getTasks({ projectId: "2315663023" });
      return {
        todo: tasks
          .filter((task) => task.sectionId === "127907867")
          .sort((a, b) => a.order - b.order)
          .map((task) => ({
            title: task.content,
            description: task.description,
          })),
        inProgress: tasks
          .filter((task) => task.sectionId === "127907869")
          .sort((a, b) => a.order - b.order)
          .map((task) => ({
            title: task.content,
            description: task.description,
          })),
        done: tasks
          .filter((task) => task.sectionId === "127907872")
          .sort((a, b) => a.order - b.order)
          .map((task) => ({
            title: task.content,
            description: task.description,
          })),
      };
    } catch (error) {
      console.log(error);
      // TODO: sentry & 500 error
      throw new Error("Error fetching roadmap");
    }
  }),
});
