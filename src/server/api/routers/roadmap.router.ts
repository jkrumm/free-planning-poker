import { env } from 'fpp/env';

import { toCustomTRPCError } from 'fpp/server/api/custom-error';
import { createTRPCRouter, publicProcedure } from 'fpp/server/api/trpc';

type Task = {
  id: string;
  task_id: string;
  section_id: string;
  order: number;
  content: string;
  description: string;
  parent_id: string | undefined;
};

export type Subtask = {
  title: string;
  description: string | null;
  done: boolean;
};

export type Todo = {
  title: string;
  description: string | null;
  subtasks: Subtask[];
};

const sectionId = {
  todo: '127907867',
  inProgress: '127907869',
  done: '127907872',
} as const;

const mapTasksToTodos = (
  tasks: Task[],
  completedTasks: Task[],
  section: (typeof sectionId)[keyof typeof sectionId],
): Todo[] => {
  return tasks
    .filter((task) => task.section_id === section && !task.parent_id)
    .sort((a, b) => a.order - b.order)
    .map((task) => ({
      title: task.content,
      description: task.description === '' ? null : task.description,
      subtasks: [
        ...tasks
          .filter((subtask) => subtask.parent_id === task.id)
          .sort((a, b) => a.order - b.order)
          .map((subtask) => ({
            title: subtask.content,
            description:
              subtask.description === '' ? null : subtask.description,
            done: false,
          })),
        ...completedTasks
          .filter((completedTask) => completedTask.parent_id === task.id)
          .map((completedTask) => ({
            title: completedTask.content,
            description:
              completedTask.description === ''
                ? null
                : completedTask.description,
            done: true,
          })),
      ],
    }));
};

export const roadmapRouter = createTRPCRouter({
  getRoadmap: publicProcedure.query<{
    todo: Todo[];
    inProgress: Todo[];
    done: Todo[];
  }>(async () => {
    // Load all running tasks
    const tasksResponse = await fetch(
      `https://api.todoist.com/sync/v9/projects/get_data?project_id=2315663023`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.TODOIST_SECRET}`,
        },
      },
    ).catch((error) => {
      throw toCustomTRPCError(error, 'Failed to fetch running tasks', {
        component: 'roadmapRouter',
        action: 'getRoadmap',
        extra: {
          endpoint: 'projects/get_data',
        },
      });
    });

    if (!tasksResponse.ok) {
      throw toCustomTRPCError(
        new Error(
          `Todoist API error: ${tasksResponse.status} ${tasksResponse.statusText}`,
        ),
        'Todoist API returned error for running tasks',
        {
          component: 'roadmapRouter',
          action: 'getRoadmap',
          extra: {
            endpoint: 'projects/get_data',
            status: tasksResponse.status,
          },
        },
      );
    }

    const tasks = ((await tasksResponse.json()) as { items: Task[] }).items;

    // Load all completed tasks
    const completedTasksResponse = await fetch(
      `https://api.todoist.com/sync/v9/completed/get_all?project_id=2315663023`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.TODOIST_SECRET}`,
        },
      },
    ).catch((error) => {
      throw toCustomTRPCError(error, 'Failed to fetch completed tasks', {
        component: 'roadmapRouter',
        action: 'getRoadmap',
        extra: {
          endpoint: 'completed/get_all',
        },
      });
    });

    if (!completedTasksResponse.ok) {
      throw toCustomTRPCError(
        new Error(
          `Todoist API error: ${completedTasksResponse.status} ${completedTasksResponse.statusText}`,
        ),
        'Todoist API returned error for completed tasks',
        {
          component: 'roadmapRouter',
          action: 'getRoadmap',
          extra: {
            endpoint: 'completed/get_all',
            status: completedTasksResponse.status,
          },
        },
      );
    }

    let completedTasks = (
      (await completedTasksResponse.json()) as { items: Task[] }
    ).items;

    // Completed tasks don't have a parent_id, so we need to fetch the parent_id of each completed task
    completedTasks = await Promise.all(
      completedTasks.map(async (task) => {
        const completedTaskDetailResponse = await fetch(
          `https://api.todoist.com/sync/v9/items/get?item_id=${task.task_id}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${env.TODOIST_SECRET}`,
            },
          },
        ).catch((error) => {
          throw toCustomTRPCError(error, 'Failed to fetch task details', {
            component: 'roadmapRouter',
            action: 'getRoadmap',
            extra: {
              endpoint: 'items/get',
              taskId: task.task_id,
            },
          });
        });

        if (!completedTaskDetailResponse.ok) {
          throw toCustomTRPCError(
            new Error(
              `Todoist API error: ${completedTaskDetailResponse.status} ${completedTaskDetailResponse.statusText}`,
            ),
            'Todoist API returned error for task details',
            {
              component: 'roadmapRouter',
              action: 'getRoadmap',
              extra: {
                endpoint: 'items/get',
                taskId: task.task_id,
                status: completedTaskDetailResponse.status,
              },
            },
          );
        }

        const completedTaskDetail =
          (await completedTaskDetailResponse.json()) as {
            ancestors: {
              id: string;
            }[];
            item: {
              description: string;
            };
          };

        return {
          ...task,
          parent_id: completedTaskDetail.ancestors[0]?.id,
          description: completedTaskDetail.item.description,
        };
      }),
    );

    return {
      todo: mapTasksToTodos(tasks, completedTasks, sectionId.todo),
      inProgress: mapTasksToTodos(tasks, completedTasks, sectionId.inProgress),
      done: mapTasksToTodos(tasks, completedTasks, sectionId.done),
    };
  }),
});
