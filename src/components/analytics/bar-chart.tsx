import React, { useState } from 'react';

import dynamic from 'next/dynamic';

import { type ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export const BarChart = ({
  headline,
  data,
}: {
  headline: string;
  data: { name: string; value: number }[];
}) => {
  const [options] = useState<ApexOptions>({
    chart: {
      id: headline.replace(' ', '-'),
      foreColor: '#C1C2C5',
      animations: {
        enabled: false,
      },
    },
    xaxis: {
      categories: data.map((d) => d.name),
    },
    noData: { text: 'Loading...' },
    colors: ['#1971c2'],
    tooltip: {
      fillSeriesColor: true, //This is for the tooltip color
      theme: 'dark', //You will need to work with this option to apply the dark theme.
    },
    theme: {
      palette: 'palette2', //Check the list of available palettes and choose one.
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
      },
    },
    grid: { borderColor: '#3e3e3e' },
  });

  const [series] = useState<ApexAxisChartSeries | ApexNonAxisChartSeries>([
    {
      data: data.map((d) => d.value),
    },
  ]);

  return (
    <div className="h-[500px] w-full">
      <h2>{headline}</h2>
      <Chart
        options={options}
        series={series}
        type="bar"
        width="100%"
        height="430px"
      />
    </div>
  );
};
