// 结果预览页面逻辑
const StorageManager = require('../../utils/storage.js');

Page({
  data: {
    // 用户基本信息
    userInfo: {
      name: '',
      age: '',
      gender: '',
      examNo: ''
    },
    
    // 健康信息摘要
    healthHighlights: [],
    
    // 通用体检建议
    generalAdvice: '',
    
    // 详细答案数据
    detailedAnswers: [],
    
    // UI状态
    isDetailModalOpen: false,
    
    // 问卷记录ID
    recordId: ''
  },

  // 页面加载
  onLoad: function(options) {
    if (options.recordId) {
      this.setData({
        recordId: options.recordId
      });
      this.loadResultData(options.recordId);
    } else {
      // 如果没有recordId，尝试从本地缓存加载最后一次提交的数据
      this.loadFromLocalStorage();
    }
  },

  // 从本地缓存加载数据
  loadFromLocalStorage: function() {
    // 从本地缓存获取最后一次提交的数据
    const savedData = StorageManager.getCompleteQuestionnaireData();
    if (savedData && savedData.answers) {
      this.processRealData(savedData.answers, savedData.questionnaire_template);
    } else {
      // 如果没有数据，使用模拟数据
      const mockData = this.generateMockResultData();
      this.processResultData(mockData);
    }
  },

  // 加载结果数据
  loadResultData: function(recordId) {
    // 从云数据库加载提交的数据
    wx.cloud.database().collection('fill_record').where({
      record_id: recordId
    }).get({
      success: (res) => {
        if (res.data && res.data.length > 0) {
          const record = res.data[0];
          // 获取问卷模板
          const questionnaire = StorageManager.getQuestionnaire()?.template;
          this.processRealData(record.answers, questionnaire);
        } else {
          console.log('未找到记录，使用本地缓存');
          this.loadFromLocalStorage();
        }
      },
      fail: (err) => {
        console.error('从数据库加载失败:', err);
        this.loadFromLocalStorage();
      }
    });
  },

  // 处理真实数据
  processRealData: function(answers, questionnaire) {
    // 提取用户基本信息
    const userInfo = {
      name: answers[1] || '',
      age: answers[3] || '',
      gender: answers[4] || '',
      examNo: answers[2] || ''
    };

    // 格式化性别显示
    if (userInfo.gender === 'A. 男性') {
      userInfo.gender = '男性';
    } else if (userInfo.gender === 'B. 女性') {
      userInfo.gender = '女性';
    }

    // 生成详细答案列表
    const detailedAnswers = [];
    if (questionnaire && questionnaire.questions) {
      questionnaire.questions.forEach(question => {
        const answer = answers[question.id];
        let formattedAnswer = answer;

        // 格式化数组答案（多选题）
        if (Array.isArray(answer)) {
          formattedAnswer = answer.join('、');
        }

        detailedAnswers.push({
          id: question.id,
          content: question.content,
          answer: formattedAnswer || '未填写'
        });
      });
    }

    this.setData({
      userInfo: userInfo,
      detailedAnswers: detailedAnswers
    });

    // 调用AI生成健康信息摘要
    this.generateAIHealthSummary(answers);
  },

  // 生成模拟结果数据
  generateMockResultData: function() {
    return {
      userInfo: {
        name: '张先生',
        age: '56',
        gender: '男性',
        examNo: 'TJ20250001'
      },
      healthHighlights: [
        '有糖尿病家族史',
        '目前无糖尿病诊断',
        '饮食习惯偏向细粮',
        '每周运动3天以上',
        '睡眠质量良好'
      ],
      generalAdvice: '建议定期监测血糖，保持健康饮食和适量运动。如有不适，请及时就医。',
      detailedAnswers: [
        { id: 0, content: '姓名', answer: '张先生' },
        { id: 1, content: '手机号', answer: 'TJ20250001' },
        { id: 2, content: '年龄', answer: '56' },
        { id: 3, content: '性别', answer: 'A. 男性' },
        { id: 4, content: '受教育程度', answer: 'E. 大学及以上' },
        { id: 5, content: '您的父母或兄弟姐妹是否患有以下明确诊断的疾病？', answer: 'E. 糖尿病, U. 以上皆无' }
      ]
    };
  },

  // 处理结果数据
  processResultData: function(data) {
    this.setData({
      userInfo: data.userInfo,
      healthHighlights: data.healthHighlights,
      generalAdvice: data.generalAdvice,
      detailedAnswers: data.detailedAnswers
    });
  },

  // 查看详细答案
  viewDetails: function() {
    this.setData({
      isDetailModalOpen: true
    });
  },

  // 关闭详细答案模态框
  closeDetailModal: function() {
    this.setData({
      isDetailModalOpen: false
    });
  },

  // 阻止事件冒泡
  stopPropagation: function(e) {
    // 阻止点击模态框内容时关闭
    return;
  },

  // 重新填写问卷
  restartQuestionnaire: function() {
    wx.showModal({
      title: '重新填写',
      content: '确定要重新填写问卷吗？当前填写结果将会被清空。',
      success: (res) => {
        if (res.confirm) {
          // 清空本地缓存
          StorageManager.clearQuestionnaire();
          
          // 跳转到问卷页面
          wx.switchTab({
            url: '/pages/questionnaire/questionnaire'
          });
        }
      }
    });
  },

  // 生成健康摘要
  generateHealthSummary: function(answers) {
    const highlights = [];
    
    // 分析关键健康信息
    if (answers[5] && answers[5].includes('E. 糖尿病')) {
      highlights.push('有糖尿病家族史');
    }
    
    if (answers[7] && answers[7].includes('E. 糖尿病')) {
      highlights.push('当前有糖尿病诊断');
    } else {
      highlights.push('目前无糖尿病诊断');
    }
    
    if (answers[14]) {
      const diet = answers[14];
      if (diet === 'A. 细粮为主') {
        highlights.push('饮食习惯偏向细粮');
      } else if (diet === 'C. 粗粮为主') {
        highlights.push('饮食习惯偏向粗粮');
      }
    }
    
    if (answers[13]) {
      const exercise = answers[13];
      if (exercise === 'C.3 天以上') {
        highlights.push('每周运动3天以上');
      } else if (exercise === 'A. 不到 1 天') {
        highlights.push('运动量较少');
      }
    }
    
    if (answers[19]) {
      const sleep = answers[19];
      if (sleep === 'C.7-9 小时') {
        highlights.push('睡眠质量良好');
      } else if (sleep === 'A.<5 小时') {
        highlights.push('睡眠时间不足');
      }
    }
    
    return highlights;
  },

  // 生成通用建议
  generateGeneralAdvice: function(answers) {
    let advice = '建议保持健康生活方式，定期体检。';

    // 根据关键信息生成建议
    if (answers[5] && answers[5].includes('E. 糖尿病')) {
      advice += '由于有糖尿病家族史，建议定期监测血糖。';
    }

    if (answers[13] && answers[13] === 'A. 不到 1 天') {
      advice += '适当增加运动量有助于健康。';
    }

    if (answers[14] && answers[14] === 'A. 细粮为主') {
      advice += '建议适当增加粗粮摄入。';
    }

    advice += '如有不适，请及时咨询专业医生。';

    return advice;
  },

  // 调用AI生成健康信息摘要
  generateAIHealthSummary: function(answers) {
    this.setData({
      isLoading: true
    });

    // 构建提示词
    const prompt = this.buildHealthSummaryPrompt(answers);

    // 调用云函数获取AI分析
    wx.cloud.callFunction({
      name: 'interact',
      data: {
        eventType: 'generateHealthSummary',
        answers: answers,
        prompt: prompt
      },
      success: (res) => {
        if (res.result && res.result.success) {
          const healthHighlights = res.result.healthHighlights || [];
          const generalAdvice = res.result.generalAdvice || '';

          this.setData({
            healthHighlights: healthHighlights,
            generalAdvice: generalAdvice,
            isLoading: false
          });
        } else {
          // AI调用失败，使用本地生成的摘要
          const localHighlights = this.generateHealthSummary(answers);
          const localAdvice = this.generateGeneralAdvice(answers);

          this.setData({
            healthHighlights: localHighlights,
            generalAdvice: localAdvice,
            isLoading: false
          });
        }
      },
      fail: (err) => {
        console.error('AI生成失败:', err);
        // 使用本地生成的摘要
        const localHighlights = this.generateHealthSummary(answers);
        const localAdvice = this.generateGeneralAdvice(answers);

        this.setData({
          healthHighlights: localHighlights,
          generalAdvice: localAdvice,
          isLoading: false
        });
      }
    });
  },

  // 构建健康摘要提示词
  buildHealthSummaryPrompt: function(answers) {
    const age = answers[3] || '未知';
    const gender = answers[4] || '未知';
    const education = answers[5] || '未知';

    // 家族病史
    const familyHistory = Array.isArray(answers[6]) ? answers[6].join('、') : '无';

    // 个人病史
    const personalHistory = Array.isArray(answers[8]) ? answers[8].join('、') : '无';

    // 用药情况
    const medications = Array.isArray(answers[9]) ? answers[9].join('、') : '无';

    // 生活习惯
    const smoking = answers[12] || '未知';
    const drinking = answers[13] || '未知';
    const exercise = answers[14] || '未知';
    const diet = answers[15] || '未知';
    const sleep = answers[20] || '未知';

    // 情绪状态
    const mood = answers[21] || '未知';

    // 健康关注点
    const healthConcern = answers[31] || '无';

    // 女性专属
    const femaleHealth1 = answers[32] || '不适用';
    const femaleHealth2 = answers[33] || '不适用';

    return `请根据以下问卷填写结果，生成健康信息摘要和建议：

基本信息：${age}岁，${gender}，受教育程度：${education}

家族病史：${familyHistory}
个人病史：${personalHistory}
用药情况：${medications}

生活习惯：
- 吸烟：${smoking}
- 饮酒：${drinking}
- 运动：${exercise}
- 饮食：${diet}
- 睡眠：${sleep}
- 情绪状态：${mood}

健康关注点：${healthConcern}

女性健康（如适用）：${femaleHealth1}，${femaleHealth2}

请生成：
1. 5-8条健康信息摘要（简洁，每条不超过15字）
2. 100-150字的个性化健康建议

输出格式为JSON：
{
  "healthHighlights": ["摘要1", "摘要2", ...],
  "generalAdvice": "健康建议内容"
}`;
  }
});