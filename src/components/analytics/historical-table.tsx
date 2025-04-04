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
    rooms: number;
    acc_rooms: number;
  }[];
  historicalTableOpen: boolean;
}) => {
  const rows = historical.map((element, index) => (
    <Table.Tr key={index}>
      <Table.Td className="pl-2">{element.date.toDateString()}</Table.Td>
      <Table.Td className="mono">{element.estimations}</Table.Td>
      <Table.Td className="mono">{element.acc_estimations}</Table.Td>
      <Table.Td className="mono">{element.votes}</Table.Td>
      <Table.Td className="mono">{element.acc_votes}</Table.Td>
      <Table.Td className="mono">{element.page_views}</Table.Td>
      <Table.Td className="mono">{element.acc_page_views}</Table.Td>
      <Table.Td className="mono">{element.new_users}</Table.Td>
      <Table.Td className="mono">{element.acc_new_users}</Table.Td>
      <Table.Td className="mono">{element.rooms}</Table.Td>
      <Table.Td className="mono">{element.acc_rooms}</Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      <Collapse in={historicalTableOpen}>
        <Card withBorder radius="md" padding="0" className="mb-12">
          <div className="overflow-y-scroll max-h-[400px]">
            <Table
              highlightOnHover
              stickyHeader
              withRowBorders={true}
              className="p-0 m-0"
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th className="pl-2">Date</Table.Th>
                  <Table.Th>Estimations</Table.Th>
                  <Table.Th>Acc estimations</Table.Th>
                  <Table.Th>Votes</Table.Th>
                  <Table.Th>Acc votes</Table.Th>
                  <Table.Th>Page views</Table.Th>
                  <Table.Th>Acc page views</Table.Th>
                  <Table.Th>New users</Table.Th>
                  <Table.Th>Acc new users</Table.Th>
                  <Table.Th>Rooms</Table.Th>
                  <Table.Th>Acc rooms</Table.Th>
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
