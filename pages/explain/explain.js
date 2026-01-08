// 填写说明页面逻辑
Page({
  data: {
    // 页面数据
  },

  // 页面加载
  onLoad: function(options) {
    console.log('填写说明页面加载');
  },

  // 页面显示
  onShow: function() {
    console.log('填写说明页面显示');
  },

  // 开始填写问卷
  startQuestionnaire: function() {
    wx.switchTab({
      url: '/pages/questionnaire/questionnaire'
    });
  }
});