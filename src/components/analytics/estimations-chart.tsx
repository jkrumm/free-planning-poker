import React from 'react';

import { AgChartsReact } from 'ag-charts-react';

export const EstimationChart = ({
  estimation_counts,
}: {
  estimation_counts: Record<string, number>;
}) => {
  const data = Object.entries(estimation_counts).map(([key, value]) => ({
    category: key,
    value,
  }));

  return (
    <div className="h-[450px] w-full">
      <AgChartsReact
        options={{
          data,
          theme: 'ag-polychroma-dark',
          background: {
            fill: '#242424',
          },
          title: {
            text: 'Popularity of each Estimation Fibonacci Number',
          },
          series: [
            {
              type: 'bar',
              xKey: 'category',
              yKey: 'value',
              fill: '#C4C4C4',
            },
          ],
          axes: [
            {
              type: 'category',
              position: 'bottom',
              title: {
                text: 'Estimation Number',
              },
              keys: ['category'],
            },
            {
              type: 'number',
              position: 'left',
              title: {
                text: 'Estimation Amount',
              },
              keys: ['value'],
            },
          ],
        }}
      />
    </div>
  );
};
