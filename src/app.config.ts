export default defineAppConfig({
  pages: [
    'pages/voyage/index',
    'pages/tank/index',
    'pages/refuel/index',
    'pages/analysis/index',
    'pages/handover/index',
    'pages/fleet/index',
    'pages/vessel-detail/index',
    'pages/vessel-tracking/index',
    'pages/voyage-detail/index',
    'pages/offline-queue/index',
    'pages/create-voyage/index',
    'pages/history/index',
    'pages/refuel-detail/index',
    'pages/anomaly-detail/index',
    'pages/handover-preview/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1E88E5',
    navigationBarTitleText: '燃油记录',
    navigationBarTextStyle: 'white',
    backgroundColor: '#F5F7FA'
  },
  tabBar: {
    color: '#90A4AE',
    selectedColor: '#1E88E5',
    backgroundColor: '#FFFFFF',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/voyage/index',
        text: '航次首页'
      },
      {
        pagePath: 'pages/tank/index',
        text: '油舱记录'
      },
      {
        pagePath: 'pages/refuel/index',
        text: '加油登记'
      },
      {
        pagePath: 'pages/analysis/index',
        text: '油耗分析'
      },
      {
        pagePath: 'pages/handover/index',
        text: '交接确认'
      }
    ]
  }
})
