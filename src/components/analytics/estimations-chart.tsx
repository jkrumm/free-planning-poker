import React from 'react';

import { AgChartsReact } from 'ag-charts-react';

export const EstimationChart = ({
  data,
  title,
  yXisName,
  xAxisName,
}: {
  data: Record<string, number>;
  title: string;
  yXisName: string;
  xAxisName: string;
}) => {
  const mappedData = Object.entries(data).map(([key, value]) => ({
    category: key,
    value,
  }));

  return (
    <div className="h-[450px] w-full">
      <AgChartsReact
        options={{
          data: mappedData,
          theme: 'ag-polychroma-dark',
          background: {
            fill: '#242424',
          },
          title: {
            text: title,
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
                text: xAxisName,
              },
              keys: ['category'],
            },
            {
              type: 'number',
              position: 'left',
              title: {
                text: yXisName,
              },
              keys: ['value'],
            },
          ],
        }}
      />
    </div>
  );
};
