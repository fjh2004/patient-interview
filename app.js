// 小程序入口文件 - 糖尿病患者体检前问卷智能交互系统
// 技术栈：微信小程序原生 + 微信云开发（云函数 + 云数据库）

App({
  // 小程序初始化时执行
  onLaunch: function () {
    // 初始化云开发环境
    // 注意：请在微信开发者工具中替换为您的云环境ID
    wx.cloud.init({
      env: 'cloud1-1gph1bi2e2bea3e1', // 需替换：您的云环境ID
      traceUser: true
    });
    
    // 检查本地是否有未完成的问卷
    this.checkLocalStorage();
  },

  // 检查本地存储的问卷数据
  checkLocalStorage: function() {
    try {
      const questionnaireData = wx.getStorageSync('diabetes_questionnaire');
      if (questionnaireData) {
        console.log('检测到本地未完成问卷，进度：', questionnaireData.progress);
        // 这里可以添加提示逻辑，但根据需求直接进入问卷页
      }
    } catch (e) {
      console.error('读取本地缓存失败：', e);
      // 缓存异常时清空并提示
      this.clearLocalStorage();
      wx.showToast({
        title: '缓存异常，将重新开始填写',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 清空本地存储
  clearLocalStorage: function() {
    try {
      wx.removeStorageSync('diabetes_questionnaire');
    } catch (e) {
      console.error('清空缓存失败：', e);
    }
  },

  // 全局数据
  globalData: {
    // 云环境配置（需替换）
    cloudEnv: 'your-cloud-env-id',
    
    // LLM API配置（智谱AI，需替换）
    llmConfig: {
      apiKey: 'your-zhipu-api-key',      // 智谱API Key
      apiSecret: 'your-zhipu-api-secret', // 智谱API Secret
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    },
    
    // 问卷配置
    questionnaireConfig: {
      totalQuestions: 32,  // 总题数
      timeout: 30000,      // 30秒无操作提醒
      llmTimeout: 5000     // LLM接口超时时间
    }
  }
});