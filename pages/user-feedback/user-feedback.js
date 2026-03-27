// pages/user-feedback/user-feedback.js
const app = getApp();

Page({
  data: {
    // 用户分组信息
    group: 'experimental', // experimental 或 control
    session_id: '',
    user_id: '',
    questionnaire_id: '',

    // 问题1：满意度评分（1-10分）
    satisfactionScore: 0,
    
    // 问题2：推荐意愿（A-E）
    recommendationLevel: '',
    
    // 问题3：AI功能比较（区分实验组/对照组）
    aiComparison: '',
    
    // 问题4：AI干预接受度（仅实验组）
    aiAcceptance: '',
    
    // 推荐意愿选项
    recommendationOptions: [
      { value: 'A', label: 'A. 非常愿意' },
      { value: 'B', label: 'B. 愿意' },
      { value: 'C', label: 'C. 一般' },
      { value: 'D', label: 'D. 不太愿意' },
      { value: 'E', label: 'E. 完全不愿意' }
    ],
    
    // AI功能比较选项（对照组版本）
    aiComparisonControlOptions: [
      { value: 'A', label: 'A. 会更好' },
      { value: 'B', label: 'B. 可能会更好' },
      { value: 'C', label: 'C. 不确定/没影响' },
      { value: 'D', label: 'D. 可能会更差' },
      { value: 'E', label: 'E. 会更差' }
    ],
    
    // AI功能比较选项（实验组版本）
    aiComparisonExpOptions: [
      { value: 'A', label: 'A. 会更差' },
      { value: 'B', label: 'B. 可能会更差' },
      { value: 'C', label: 'C. 不确定/没影响' },
      { value: 'D', label: 'D. 可能会更好' },
      { value: 'E', label: 'E. 会更好' }
    ],
    
    // AI接受度选项（仅实验组）
    aiAcceptanceOptions: [
      { value: 'A', label: 'A. 非常接受，希望更多应用' },
      { value: 'B', label: 'B. 比较接受，有帮助' },
      { value: 'C', label: 'C. 一般，可有可无' },
      { value: 'D', label: 'D. 不太接受，有点干扰' },
      { value: 'E', label: 'E. 完全不接受，更喜欢传统方式' }
    ],
    
    // UI状态
    isLoading: false,
    errorMessage: '',
    isSubmitting: false
  },

  // 页面加载
  onLoad: function(options) {
    console.log('[用户反馈] 页面加载，参数:', options);
    
    // 获取传递的参数
    const { group = 'experimental', session_id = '', user_id = '', questionnaire_id = '' } = options || {};
    
    // 设置数据
    this.setData({
      group: group,
      session_id: session_id,
      user_id: user_id,
      questionnaire_id: questionnaire_id
    });
    
    console.log('[用户反馈] 用户分组:', group);
  },

  // 选择满意度评分
  selectSatisfactionScore: function(e) {
    const score = parseInt(e.currentTarget.dataset.score);
    this.setData({
      satisfactionScore: score
    });
    console.log('[用户反馈] 选择满意度评分:', score);
  },

  // 选择推荐意愿
  selectRecommendationLevel: function(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      recommendationLevel: value
    });
    console.log('[用户反馈] 选择推荐意愿:', value);
  },

  // 选择AI功能比较
  selectAiComparison: function(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      aiComparison: value
    });
    console.log('[用户反馈] 选择AI功能比较:', value);
  },

  // 选择AI接受度
  selectAiAcceptance: function(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      aiAcceptance: value
    });
    console.log('[用户反馈] 选择AI接受度:', value);
  },

  // 提交用户反馈
  submitFeedback: function() {
    // 验证必填项
    if (this.data.satisfactionScore === 0) {
      wx.showToast({
        title: '请选择满意度评分',
        icon: 'none'
      });
      return;
    }

    if (!this.data.recommendationLevel) {
      wx.showToast({
        title: '请选择推荐意愿',
        icon: 'none'
      });
      return;
    }

    if (!this.data.aiComparison) {
      wx.showToast({
        title: '请选择AI功能比较',
        icon: 'none'
      });
      return;
    }

    // 实验组需要填写AI接受度
    if (this.data.group === 'experimental' && !this.data.aiAcceptance) {
      wx.showToast({
        title: '请选择AI干预接受度',
        icon: 'none'
      });
      return;
    }

    this.setData({
      isSubmitting: true,
      errorMessage: ''
    });

    // 准备提交数据
    const feedbackData = {
      group: this.data.group,
      session_id: this.data.session_id,
      user_id: this.data.user_id,
      questionnaire_id: this.data.questionnaire_id,
      satisfaction_score: this.data.satisfactionScore,
      recommendation_level: this.data.recommendationLevel,
      ai_comparison: this.data.aiComparison,
      ai_acceptance: this.data.aiAcceptance || null, // 对照组为null
      submit_time: Date.now()
    };

    console.log('[用户反馈] 提交数据:', feedbackData);

    // 调用云函数提交反馈
    wx.cloud.callFunction({
      name: 'submitUserFeedback',
      data: feedbackData,
      success: (res) => {
        console.log('[用户反馈] 提交成功:', res);
        
        if (res.result && res.result.success) {
          // 提交成功
          wx.showToast({
            title: '感谢您的反馈！',
            icon: 'success',
            duration: 2000,
            success: () => {
              // 2秒后返回首页
              setTimeout(() => {
                wx.reLaunch({
                  url: '/pages/explain/explain'
                });
              }, 2000);
            }
          });
        } else {
          this.setData({
            errorMessage: res.result?.message || '提交失败，请重试',
            isSubmitting: false
          });
        }
      },
      fail: (err) => {
        console.error('[用户反馈] 提交失败:', err);
        this.setData({
          errorMessage: '网络错误，请稍后重试',
          isSubmitting: false
        });
      }
    });
  },

  // 跳过反馈
  skipFeedback: function() {
    wx.showModal({
      title: '确认跳过',
      content: '您的反馈对我们非常重要，是否确定跳过？',
      success: (res) => {
        if (res.confirm) {
          console.log('[用户反馈] 用户选择跳过');
          wx.reLaunch({
            url: '/pages/explain/explain'
          });
        }
      }
    });
  }
});