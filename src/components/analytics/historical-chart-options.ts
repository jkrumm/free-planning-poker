import type {
  AgCartesianChartOptions,
  AgCartesianSeriesTooltipRendererParams,
  AgTooltipRendererResult,
} from 'ag-charts-community';

// Data structure for historical analytics chart
export interface HistoricalChartData {
  date: Date;
  estimations: number;
  acc_estimations: number;
  ma_estimations: number;
  votes: number;
  acc_votes: number;
  ma_votes: number;
  rooms: number;
  acc_rooms: number;
  ma_rooms: number;
  page_views: number;
  acc_page_views: number;
  ma_page_views: number;
  new_users: number;
  acc_new_users: number;
  ma_new_users: number;
}

export function renderer(
  params: AgCartesianSeriesTooltipRendererParams,
  title: string,
  _color: string,
): AgTooltipRendererResult {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- AG Charts params datum structure
  const value = (params.datum[params.yKey] as number).toFixed(0);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- AG Charts params datum structure
  const date = new Date(params.datum[params.xKey] as Date);

  // Define an array of month names
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // Get the month, day, and year from the date
  const monthName = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  // Format the date as "May 19 2024"
  const formattedDate = `${monthName} ${day} ${year}`;
  return {
    title,
    content: `${value} on ${formattedDate}`,
  } as AgTooltipRendererResult;
}

class HistoricalChartOptions {
  showDaily = true;
  showAcc = true;
  showMa = true;

  showEstimations = false;
  showVotes = true;
  showRooms = false;
  showPageViews = false;
  showNewUsers = false;

  toggleShowDaily() {
    this.showDaily = !this.showDaily;
    return this.toOptions();
  }
  toggleShowAcc() {
    this.showAcc = !this.showAcc;
    return this.toOptions();
  }
  toggleShowMa() {
    this.showMa = !this.showMa;
    return this.toOptions();
  }

  toggleEstimations() {
    this.showEstimations = !this.showEstimations;
    return this.toOptions();
  }
  toggleVotes() {
    this.showVotes = !this.showVotes;
    return this.toOptions();
  }
  toggleRooms() {
    this.showRooms = !this.showRooms;
    return this.toOptions();
  }
  togglePageViews() {
    this.showPageViews = !this.showPageViews;
    return this.toOptions();
  }
  toggleNewUsers() {
    this.showNewUsers = !this.showNewUsers;
    return this.toOptions();
  }

  get leftLegendName() {
    if (this.showDaily && this.showMa) {
      return 'Daily & 30-Day MA';
    } else if (this.showDaily) {
      return 'Daily';
    } else if (this.showMa) {
      return '30-Day MA';
    }
    return '';
  }

  toOptions(): AgCartesianChartOptions {
    // Note: AG Charts v13 runtime supports yAxis on series, but TypeScript types don't include it yet
    // This is a known discrepancy between the migration guide and type definitions
    // Using double type assertion to work around incomplete type definitions
    return {
      theme: 'ag-polychroma-dark',
      background: {
        fill: '#242424',
      },
      height: 600,
      legend: {
        enabled: false,
      },
      navigator: {
        enabled: false,
      },
      tooltip: {
        enabled: true,
      },
      series: [
        {
          type: 'bar',
          xKey: 'date',
          yKey: 'estimations',
          yName: 'Estimations Daily',
          stacked: true,
          visible: this.showEstimations && this.showDaily,
          fill: '#40C057',
          fillOpacity: this.showAcc || this.showMa ? 0.2 : 1,
          tooltip: {
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Estimations Daily', '#40C057'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'acc_estimations',
          yAxis: 'yRight',
          yName: 'Estimations Acc',
          visible: this.showEstimations && this.showAcc,
          strokeWidth: 2,
          stroke: '#40C057',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Estimations Acc', '#40C057'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'ma_estimations',
          yName: 'Estimations MA',
          visible: this.showEstimations && this.showMa,
          strokeWidth: 2,
          strokeOpacity: 0.6,
          stroke: '#40C057',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Estimations MA', '#40C057'),
          },
        },
        {
          type: 'bar',
          xKey: 'date',
          yKey: 'votes',
          yName: 'Votes Daily',
          stacked: true,
          visible: this.showVotes && this.showDaily,
          fill: '#1971C2',
          fillOpacity: this.showAcc || this.showMa ? 0.2 : 1,
          tooltip: {
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Votes Daily', '#1971C2'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'acc_votes',
          yAxis: 'yRight',
          yName: 'Votes Acc',
          visible: this.showVotes && this.showAcc,
          strokeWidth: 2,
          stroke: '#1971C2',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Votes Acc', '#1971C2'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'ma_votes',
          yName: 'Votes MA',
          visible: this.showVotes && this.showMa,
          strokeWidth: 2,
          strokeOpacity: 0.6,
          stroke: '#1971C2',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Votes MA', '#1971C2'),
          },
        },
        {
          type: 'bar',
          xKey: 'date',
          yKey: 'rooms',
          yName: 'Rooms Daily',
          stacked: true,
          visible: this.showRooms && this.showDaily,
          fill: '#8931B2',
          fillOpacity: this.showAcc || this.showMa ? 0.2 : 1,
          tooltip: {
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Rooms Daily', '#8931B2'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'acc_rooms',
          yAxis: 'yRight',
          yName: 'Rooms Acc',
          visible: this.showRooms && this.showAcc,
          strokeWidth: 2,
          stroke: '#8931B2',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Rooms Acc', '#8931B2'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'ma_rooms',
          yName: 'Rooms MA',
          visible: this.showRooms && this.showMa,
          strokeWidth: 2,
          strokeOpacity: 0.6,
          stroke: '#8931B2',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Rooms MA', '#8931B2'),
          },
        },
        {
          type: 'bar',
          xKey: 'date',
          yKey: 'page_views',
          yName: 'Pages Views Daily',
          stacked: true,
          visible: this.showPageViews && this.showDaily,
          fill: '#FA5252',
          fillOpacity: this.showAcc || this.showMa ? 0.2 : 1,
          tooltip: {
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Pages Views Daily', '#FA5252'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'acc_page_views',
          yAxis: 'yRight',
          yName: 'Page Views Acc',
          visible: this.showPageViews && this.showAcc,
          strokeWidth: 2,
          stroke: '#FA5252',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Page Views Acc', '#FA5252'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'ma_page_views',
          yName: 'Page Views MA',
          visible: this.showPageViews && this.showMa,
          strokeWidth: 2,
          strokeOpacity: 0.6,
          stroke: '#FA5252',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Page Views MA', '#FA5252'),
          },
        },
        {
          type: 'bar',
          xKey: 'date',
          yKey: 'new_users',
          yName: 'Unique Users Daily',
          stacked: true,
          visible: this.showNewUsers && this.showDaily,
          fill: '#FAB005',
          fillOpacity: this.showAcc || this.showMa ? 0.2 : 1,
          tooltip: {
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Unique Users Daily', '#FAB005'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'acc_new_users',
          yAxis: 'yRight',
          yName: 'Unique Users Acc',
          visible: this.showNewUsers && this.showAcc,
          strokeWidth: 2,
          stroke: '#FAB005',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Unique Users Acc', '#FAB005'),
          },
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'ma_new_users',
          yName: 'Unique Users MA',
          visible: this.showNewUsers && this.showMa,
          strokeWidth: 2,
          strokeOpacity: 0.6,
          stroke: '#FAB005',
          marker: {
            enabled: false,
          },
          interpolation: {
            type: 'smooth',
          },
          tooltip: {
            renderer: (params: AgCartesianSeriesTooltipRendererParams) =>
              renderer(params, 'Unique Users MA', '#FAB005'),
          },
        },
      ],
      axes: {
        x: {
          type: 'time',
          position: 'bottom',
        },
        y: {
          type: 'number',
          position: 'left',
          title: {
            text: this.leftLegendName,
          },
          // label: {
          //   formatter: (params) => {
          //     return params.value / 1000 + 'M';
          //   },
          // },
        },
        yRight: {
          type: 'number',
          position: 'right',
          title: {
            enabled: true,
            text: 'Accumulated amount',
          },
          // label: {
          //   formatter: (params) => {
          //     return params.value / 1000 + 'k';
          //   },
          // },
        },
      },
    } as unknown as AgCartesianChartOptions;
  }
}

export const ChartOptions = new HistoricalChartOptions();
