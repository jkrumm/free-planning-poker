import { useEffect, useState } from 'react';

import { Card, Table } from '@mantine/core';

const PointsTable = () => {
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 950);
    };

    // this condition will prevent the unexpected behavior on the server side
    if (typeof window !== 'undefined') {
      // set initial state
      setIsSmallScreen(window.innerWidth < 950);

      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  const data = [
    [
      '1',
      'Straight forward task, requiring adjustments at few places',
      'Max. 1h',
    ],
    [
      '2',
      'Straight forward task, requires more work in implementation, increased documentation or information requirement',
      '2-4h',
    ],
    [
      '3',
      'Either a straightforward task with high implementation effort or a complex task with clear problem-solution path',
      '4-8h',
    ],
    ['5', 'Complex tasks with unclear solutions and implementations', '8-16h'],
    [
      '8',
      'Complex tasks with unclear solutions leading to high implementation efforts',
      '16-32h',
    ],
    [
      '13',
      'Very complex tasks with unclear solutions leading to very high implementation efforts',
      'At least one week',
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
      withRowBorders={false}
      className="w-full overflow-hidden"
    >
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Story Points</Table.Th>
          <Table.Th>Description</Table.Th>
          <Table.Th>Completion Time</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {data.map((row, idx) => (
          <Table.Tr key={idx}>
            {row.map((cell, idx) => (
              <Table.Td key={idx}>{cell}</Table.Td>
            ))}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
};

export default PointsTable;
