import { Card, Table } from "@mantine/core";
import { useEffect, useState } from "react";

const PointsTable = () => {
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 950);
    };

    // this condition will prevent the unexpected behavior on the server side
    if (typeof window !== "undefined") {
      // set initial state
      setIsSmallScreen(window.innerWidth < 950);

      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }
  }, []);

  const data = [
    [
      "1",
      "Straight forward task, requiring adjustments at few places",
      "Max. 1h",
    ],
    [
      "2",
      "Straight forward task, requires more work in implementation, increased documentation or information requirement",
      "2-4h",
    ],
    [
      "3",
      "Either a straightforward task with high implementation effort or a complex task with clear problem-solution path",
      "4-8h",
    ],
    ["5", "Complex tasks with unclear solutions and implementations", "8-16h"],
    [
      "8",
      "Complex tasks with unclear solutions leading to high implementation efforts",
      "16-32h",
    ],
    [
      "13",
      "Very complex tasks with unclear solutions leading to very high implementation efforts",
      "At least one week",
    ],
  ];

  return isSmallScreen ? (
    <div className="p-4">
      {data.map((row, idx) => (
        <Card
          key={idx}
          className="mb-4 flex flex-col space-y-2 rounded border p-4 shadow-sm"
        >
          <h3 className="my-0">{row[0]}</h3>
          <span>{row[1]}</span>
          <span>{row[2]}</span>
        </Card>
      ))}
    </div>
  ) : (
    <Table
      highlightOnHover
      verticalSpacing="md"
      fontSize="sm"
      className="w-full overflow-hidden rounded-lg shadow-lg"
    >
      <thead>
        <tr>
          <th>Story Points</th>
          <th>Description</th>
          <th>Estimated Completion Time</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, idx) => (
          <tr key={idx}>
            {row.map((cell, idx) => (
              <td key={idx}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default PointsTable;
