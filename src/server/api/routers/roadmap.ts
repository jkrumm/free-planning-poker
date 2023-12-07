import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { env } from "fpp/env.mjs";

type Task = {
  section_id: string;
  order: number;
  content: string;
  description: string;
};

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
    const tasks = (await fetch(
      `https://api.todoist.com/rest/v2/tasks?project_id=2315663023`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${env.TODOIST_SECRET}`,
        },
      },
    ).then((res) => res.json())) as Task[];

    return {
      todo: tasks
        .filter((task) => task.section_id === "127907867")
        .sort((a, b) => a.order - b.order)
        .map((task) => ({
          title: task.content,
          description: task.description,
        })),
      inProgress: tasks
        .filter((task) => task.section_id === "127907869")
        .sort((a, b) => a.order - b.order)
        .map((task) => ({
          title: task.content,
          description: task.description,
        })),
      done: tasks
        .filter((task) => task.section_id === "127907872")
        .sort((a, b) => a.order - b.order)
        .map((task) => ({
          title: task.content,
          description: task.description,
        })),
    };
  }),
});
