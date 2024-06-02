import type { AgChartOptions } from 'ag-charts-community';

class HistoricalChartOptions {
  showDaily = true;
  showAcc = true;

  showEstimations = false;
  showAccEstimations = false;
  showVotes = true;
  showAccVotes = true;
  showPageViews = false;
  showAccPageViews = false;
  showNewUsers = true;
  showAccNewUsers = true;

  toggleShowDaily() {
    this.showDaily = !this.showDaily;
    return this.toOptions();
  }
  toggleShowAcc() {
    this.showAcc = !this.showAcc;
    return this.toOptions();
  }

  toggleEstimations() {
    this.showEstimations = !this.showEstimations;
    this.showAccEstimations = !this.showAccEstimations;
    return this.toOptions();
  }
  toggleVotes() {
    this.showVotes = !this.showVotes;
    this.showAccVotes = !this.showAccVotes;
    return this.toOptions();
  }
  togglePageViews() {
    this.showPageViews = !this.showPageViews;
    this.showAccPageViews = !this.showAccPageViews;
    return this.toOptions();
  }
  toggleNewUsers() {
    this.showNewUsers = !this.showNewUsers;
    this.showAccNewUsers = !this.showAccNewUsers;
    return this.toOptions();
  }

  toOptions(): AgChartOptions {
    return {
      theme: 'ag-polychroma-dark',
      background: {
        fill: '#242424',
      },
      legend: {
        enabled: false,
      },
      navigator: {
        enabled: true,
      },
      tooltip: {
        enabled: false,
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
          fillOpacity: this.showAcc ? 0.2 : 1,
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'acc_estimations',
          yName: 'Estimations Acc',
          visible: this.showAccEstimations && this.showAcc,
          strokeWidth: 2,
          stroke: '#40C057',
          marker: {
            enabled: false,
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
          fillOpacity: this.showAcc ? 0.2 : 1,
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'acc_votes',
          yName: 'Votes Acc',
          visible: this.showAccVotes && this.showAcc,
          strokeWidth: 2,
          stroke: '#1971C2',
          marker: {
            enabled: false,
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
          fillOpacity: this.showAcc ? 0.2 : 1,
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'acc_page_views',
          yName: 'Page Views Acc',
          visible: this.showAccPageViews && this.showAcc,
          strokeWidth: 2,
          stroke: '#FA5252',
          marker: {
            enabled: false,
          },
        },
        {
          type: 'bar',
          xKey: 'date',
          yKey: 'new_users',
          yName: 'New Users Daily',
          stacked: true,
          visible: this.showNewUsers && this.showDaily,
          fill: '#FAB005',
          fillOpacity: this.showAcc ? 0.2 : 1,
        },
        {
          type: 'line',
          xKey: 'date',
          yKey: 'acc_new_users',
          yName: 'New Users Acc',
          visible: this.showAccNewUsers && this.showAcc,
          strokeWidth: 2,
          stroke: '#FAB005',
          marker: {
            enabled: false,
          },
        },
      ],
      axes: [
        {
          type: 'time',
          position: 'bottom',
        },
        {
          type: 'number',
          position: 'left',
          keys: ['estimations', 'votes', 'page_views', 'new_users'],
          title: {
            text: 'Daily amount',
          },
          // label: {
          //   formatter: (params) => {
          //     return params.value / 1000 + 'M';
          //   },
          // },
        },
        {
          type: 'number',
          position: 'right',
          keys: [
            'acc_estimations',
            'acc_votes',
            'acc_page_views',
            'acc_new_users',
          ],
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
      ],
    };
  }
}

export const ChartOptions = new HistoricalChartOptions();
