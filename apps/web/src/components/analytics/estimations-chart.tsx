'use client';

import React from 'react';

import type { AgCartesianChartOptions } from 'ag-charts-community';
import { AgCharts } from 'ag-charts-react';

// Data structure for estimation chart
export interface EstimationChartData {
  category: string;
  value: number;
}

const EstimationChart = ({
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
  const mappedData: EstimationChartData[] = Object.entries(data).map(
    ([key, value]) => ({
      category: key,
      value,
    }),
  );

  const options: AgCartesianChartOptions = {
    data: mappedData,
    theme: 'ag-polychroma-dark',
    height: 450,
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
    axes: {
      x: {
        type: 'category',
        position: 'bottom',
        title: {
          text: xAxisName,
        },
      },
      y: {
        type: 'number',
        position: 'left',
        title: {
          text: yXisName,
        },
      },
    },
  };

  return (
    <div className="h-[450px] w-full">
      <AgCharts options={options} />
    </div>
  );
};

export default EstimationChart;
