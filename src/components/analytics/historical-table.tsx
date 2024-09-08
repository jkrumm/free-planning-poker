'use client';

import { Card, Collapse, Table } from '@mantine/core';

export const HistoricalTable = ({
  historical,
  historicalTableOpen,
}: {
  historical: {
    date: Date;
    estimations: number;
    acc_estimations: number;
    votes: number;
    acc_votes: number;
    page_views: number;
    acc_page_views: number;
    new_users: number;
    acc_new_users: number;
  }[];
  historicalTableOpen: boolean;
}) => {
  const rows = historical.map((element, index) => (
    <Table.Tr key={index}>
      <Table.Td>{element.date.toDateString()}</Table.Td>
      <Table.Td>{element.estimations}</Table.Td>
      <Table.Td>{element.acc_estimations}</Table.Td>
      <Table.Td>{element.votes}</Table.Td>
      <Table.Td>{element.acc_votes}</Table.Td>
      <Table.Td>{element.page_views}</Table.Td>
      <Table.Td>{element.acc_page_views}</Table.Td>
      <Table.Td>{element.new_users}</Table.Td>
      <Table.Td>{element.acc_new_users}</Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      <Collapse in={historicalTableOpen}>
        <Card withBorder radius="md" padding="md" className="mb-12">
          <div className="px-2 overflow-y-scroll max-h-[400px]">
            <Table highlightOnHover stickyHeader withRowBorders={true}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Estimations</Table.Th>
                  <Table.Th>Acc estimations</Table.Th>
                  <Table.Th>Votes</Table.Th>
                  <Table.Th>Acc votes</Table.Th>
                  <Table.Th>Page views</Table.Th>
                  <Table.Th>Acc page views</Table.Th>
                  <Table.Th>New users</Table.Th>
                  <Table.Th>Acc new users</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          </div>
        </Card>
      </Collapse>
    </>
  );
};
