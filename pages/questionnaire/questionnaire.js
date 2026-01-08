// 问卷填写页面逻辑 - 糖尿病患者体检前问卷智能交互系统核心
const StorageManager = require('../../utils/storage.js');
const Validator = require('../../utils/validator.js');
const LLMFallback = require('../../utils/llmFallback.js');

// 预制问卷数据（32道题完整配置）
const QUESTIONNAIRE_TEMPLATE = {
  "title": "糖尿病体检前健康问卷",
  "questions": [
    {"id":1,"content":"姓名","type":"input_single","placeholder":"请输入您的姓名","required":true,"rule":""},
    {"id":2,"content":"手机号","type":"input_single","placeholder":"无则不填","required":false,"rule":""},
    {"id":3,"content":"年龄","type":"input_number","placeholder":"请输入实际年龄，如：56","required":true,"rule":""},
    {"id":4,"content":"性别","type":"radio","options":["A. 男性","B. 女性"],"required":true,"rule":"关联32/33题，仅女性显示"},
    {"id":5,"content":"受教育程度","type":"radio","options":["A. 未受过教育","B. 小学","C. 初中","D. 高中","E. 大学及以上"],"required":true,"rule":"适配语言表述（低学历用通俗语）"},
    {"id":6,"content":"您的父母或兄弟姐妹是否患有以下明确诊断的疾病？","type":"checkbox","options":["A. 高血压","B. 脑卒中","C. 冠心病","D. 外周血管病","E. 糖尿病","F. 肥胖症","G. 慢性肾脏疾病","H. 慢性阻塞性肺病","I. 骨质疏松","J. 肺癌","K. 肝癌","L. 胃癌","M. 食管癌","N. 结直肠癌","O. 乳腺癌","P. 胰腺癌","Q. 宫颈癌","R. 前列腺癌","S. 甲状腺癌","T. 其他疾病","U. 以上皆无"],"required":true,"rule":"与7题逻辑关联（家族史-自身患病一致性）"},
    {"id":7,"content":"您的父亲是否在 55 岁之前或母亲在 65 岁之前患有冠心病？","type":"radio","options":["A. 是","B. 否"],"required":true,"rule":""},
    {"id":8,"content":"您是否患有以下明确诊断的疾病？","type":"checkbox","options":["A. 高血压","B. 脑卒中","C. 冠心病","D. 外周血管病","E. 糖尿病","F. 肥胖症","G. 慢性肾脏疾病","H. 慢性阻塞性肺病","I. 骨质疏松","J. 肺癌","K. 肝癌","L. 胃癌","M. 食管癌","N. 结直肠癌","O. 乳腺癌","P. 胰腺癌","Q. 宫颈癌","R. 前列腺癌","S. 甲状腺癌","T. 其他疾病","U. 以上皆无"],"required":true,"rule":"与5/8题逻辑关联"},
    {"id":9,"content":"您是否长期服用药物或营养素？(连续服用 6 个月以上，平均每日服用一次以上)","type":"checkbox","options":["A. 降压药","B. 降糖药","C. 降脂药","D. 降尿酸药","E. 抗心律失常药","F. 其他","G. 以上皆无"],"required":true,"rule":"与7题逻辑关联（患病-用药一致性）"},
    {"id":10,"content":"您对什么物质过敏？","type":"checkbox","options":["A. 青霉素","B. 磺胺类","C. 链霉素","D. 头孢类","E. 其他","F. 以上皆无"],"required":true,"rule":""},
    {"id":11,"content":"您是否因疾病进行过手术治疗？(可多选)","type":"checkbox","options":["A. 头颅 (含脑)","B. 胸部 (含肺部)","C. 心脏 (含心脏介入)","D. 胃肠","E. 肝胆","F. 肾脏","G. 其它部位","H. 以上皆无"],"required":true,"rule":""},
    {"id":12,"content":"您是否吸烟？","type":"radio","options":["A. 没有","B. 吸烟","C. 已戒烟 1 年以上","D. 被动吸烟 (每周累计 1 天以上)"],"required":true,"rule":""},
    {"id":13,"content":"您是否饮酒？","type":"radio","options":["A. 不喝","B. 偶尔喝","C. 已戒酒 1 年以上","D. 经常喝 (每周大于 2 次)"],"required":true,"rule":""},
    {"id":14,"content":"您每周运动的天数","type":"radio","options":["A. 不到 1 天","B.3 天以内","C.3 天以上"],"required":true,"rule":""},
    {"id":15,"content":"您的主食结构如何","type":"radio","options":["A. 细粮为主","B. 粗细搭配","C. 粗粮为主","D. 不好说"],"required":true,"rule":""},
    {"id":16,"content":"您通常能够按时吃三餐吗？","type":"radio","options":["A. 能","B. 基本能 (每周有 2-3 次不能按时就餐)","C. 不能 (每周超过 3 次不能按时就餐)"],"required":true,"rule":""},
    {"id":17,"content":"您的进餐速度","type":"radio","options":["A. 用餐时间小于 10 分钟","B. 用餐时间大于 10 分钟"],"required":true,"rule":""},
    {"id":18,"content":"您的饮食偏好","type":"checkbox","options":["A. 熏制、腌制类","B. 油炸食品","C. 甜点","D. 吃零食 (适量坚果除外)","E. 吃快餐","F. 喝粥","G. 其他"],"required":true,"rule":""},
    {"id":19,"content":"您的饮食口味？","type":"checkbox","options":["A. 清淡","B. 咸","C. 甜","D. 高油脂","E. 辛辣","F. 热烫"],"required":true,"rule":""},
    {"id":20,"content":"您每晚的睡眠时间？(不等于卧床时间)","type":"radio","options":["A.<5 小时","B.5-7 小时","C.7-9 小时","D.>9 小时"],"required":true,"rule":""},
    {"id":21,"content":"过去的两周内感觉紧张、焦虑或烦躁的频率为？","type":"radio","options":["A. 没有","B. 数天","C. 超过一半天数","D. 几乎每天"],"required":true,"rule":"用于情绪干预（烦躁时简化选项）"},
    {"id":22,"content":"最近三个月，您有咳嗽、咳痰吗？","type":"radio","options":["A. 没有","B. 偶尔 (每周 1~2 次)","C. 经常 (每周 3 次以上)"],"required":true,"rule":""},
    {"id":23,"content":"最近三个月，您有鼻出血或浓血鼻涕吗？","type":"radio","options":["A. 没有","B. 偶尔 (每周 1~2 次)","C. 经常 (每周 3 次以上)"],"required":true,"rule":""},
    {"id":24,"content":"最近三个月，您出现过吞咽不适、哽噎感吗？","type":"radio","options":["A. 没有","B. 偶尔 (每周 1~2 次)","C. 经常 (每周 3 次以上)"],"required":true,"rule":""},
    {"id":25,"content":"最近三个月，您感到胸痛或心前区憋闷不适吗？","type":"radio","options":["A. 没有","B. 偶尔 (每周 1~2 次)","C. 经常 (每周 3 次以上)"],"required":true,"rule":""},
    {"id":26,"content":"最近三个月，您感到有胸闷气喘或呼吸困难吗？","type":"radio","options":["A. 没有","B. 偶尔 (每周 1~2 次)","C. 经常 (每周 3 次以上)"],"required":true,"rule":""},
    {"id":27,"content":"最近三个月，您感到恶心、反酸或上腹部不适吗？","type":"radio","options":["A. 没有","B. 偶尔 (每周 1~2 次)","C. 经常 (每周 3 次以上)"],"required":true,"rule":""},
    {"id":28,"content":"最近三个月，您有过不明原因跌倒或晕倒吗？","type":"radio","options":["A. 没有","B. 偶尔 (每周 1~2 次)","C. 经常 (每周 3 次以上)"],"required":true,"rule":""},
    {"id":29,"content":"最近三个月，您出现过柏油样便或便中带血吗？","type":"radio","options":["A. 没有","B. 偶尔 (每周 1~2 次)","C. 经常 (每周 3 次以上)"],"required":true,"rule":""},
    {"id":30,"content":"最近三个月，您出现过不明原因的身体消瘦或体重减轻吗？(体重减轻超过原来体重的 10%)","type":"radio","options":["A. 没有","B. 有"],"required":true,"rule":""},
    {"id":31,"content":"您最关注的健康问题是什么？","type":"input_multi","placeholder":"如：血糖控制、视力模糊等","required":false,"rule":""},
    {"id":32,"content":"(限女性填写) 最近 3 个月，您有不明原因的阴道出血、白带异常吗？","type":"radio","options":["A. 没有","B. 有"],"required":true,"rule":"仅性别选\"女性\"时显示"},
    {"id":33,"content":"(限女性填写) 您是否已经绝经？","type":"radio","options":["A. 否","B. 是"],"required":true,"rule":"仅性别选\"女性\"时显示"}
  ]
};

Page({
  data: {
    // 问卷相关数据
    questionnaire: QUESTIONNAIRE_TEMPLATE,
    currentQuestionIndex: 0,
    currentQuestion: null,
    currentAnswer: null,
    answers: {},
    progress: 0,
    totalQuestions: 33,
    progressPercent: 0,
    progressStatus: 'low',  // 进度状态：low, medium, high, complete
    isLastQuestion: false,  // 是否是最后一题

    // UI状态
    isLoading: false,
    errorMessage: '',
    isSubmitting: false,

    // AI助手相关
    isAIPanelOpen: false,
    aiBubbleMessage: '我是问卷填写助手，有疑问请点击我～',
    aiQuestion: '',
    aiDialog: [],
    quickQuestions: [
      '这个问题是什么意思？',
      '这个选项该怎么选？',
      '为什么需要填写这个？',
      '填写时需要注意什么？'
    ],

    // AI图标拖动相关
    aiIconRight: 24,
    aiIconBottom: 480,  // 40vh约等于480rpx（按屏幕高度1200rpx计算）

    // 定时器相关
    lastInteractionTime: 0,
    encouragementTimer: null,
    validationTimer: null
  },

  onLoad: function(options) {
    this.dragging = false;
    this.isClick = true;  // 用于判断是点击还是拖动
    this.touchStartTime = 0;
    // 初始化屏幕信息缓存
    this.screenInfo = wx.getSystemInfoSync();
    this.initQuestionnaire();
    this.startEncouragementTimer();
  },

  // 页面加载
  onLoad: function(options) {
    this.initQuestionnaire();
    this.startEncouragementTimer();
  },

  // 页面显示
  onShow: function() {
    this.checkAndUpdateProgress();
  },

  // 页面卸载
  onUnload: function() {
    this.clearTimers();
  },

  // 初始化问卷
  initQuestionnaire: function() {
    // 检查本地是否有未完成的问卷
    const savedData = StorageManager.getQuestionnaire();

    if (savedData) {
      // 检查答案的key格式，如果是旧格式(0,1,2...)则清空缓存
      const answerKeys = Object.keys(savedData.answers || {});
      const hasOldFormat = answerKeys.some(key => !isNaN(key) && parseInt(key) >= 0 && parseInt(key) < 10);

      if (hasOldFormat) {
        console.log('检测到旧格式数据，清空缓存重新开始');
        StorageManager.clearQuestionnaire();
        // 清空后创建新问卷
        const userInfo = StorageManager.getUserInfo() || {};
        const recordId = StorageManager.createNewQuestionnaire(userInfo, QUESTIONNAIRE_TEMPLATE);
        if (recordId) {
          console.log('创建新问卷记录：', recordId);
          this.goToQuestion(0);
        } else {
          this.showError('初始化问卷失败，请重试');
        }
      } else {
        // 恢复之前的填写进度
        this.setData({
          answers: savedData.answers || {},
          progress: savedData.progress || 0,
          questionnaire: savedData.template || QUESTIONNAIRE_TEMPLATE
        });

        // 跳转到上次的进度
        const currentIndex = Math.min(savedData.progress, this.data.totalQuestions - 1);
        this.goToQuestion(currentIndex);

        console.log('恢复问卷进度：', savedData.progress);
      }
    } else {
      // 创建新的问卷记录
      const userInfo = StorageManager.getUserInfo() || {};
      const recordId = StorageManager.createNewQuestionnaire(userInfo, QUESTIONNAIRE_TEMPLATE);

      if (recordId) {
        console.log('创建新问卷记录：', recordId);
        this.goToQuestion(0);
      } else {
        this.showError('初始化问卷失败，请重试');
      }
    }

    this.updateProgressDisplay();
    this.updateLastInteractionTime();
  },

  // 跳转到指定题目
  goToQuestion: function(index) {
    // 允许index等于totalQuestions,用于结束问卷
    if (index < 0 || index > this.data.totalQuestions) return;

    const question = this.data.questionnaire.questions[index];
    if (!question) return;

    const answer = this.data.answers[question.id];

    // 性别联动逻辑：如果是男性，跳过32、33题
    if (question.id === 32 || question.id === 33) {
      const genderAnswer = this.data.answers[4];
      if (genderAnswer !== 'B. 女性') {
        // 如果是男性，跳过女性专属问题
        if (index === 31) this.goToQuestion(32);
        if (index === 32) this.goToQuestion(33); // 跳到结束
        return;
      }
    }

    // 计算是否是最后一题
    const genderAnswer = this.data.answers[4];
    const isFemale = genderAnswer === 'B. 女性';
    const lastQuestionIndex = isFemale ? 32 : 30;
    const isLast = index === lastQuestionIndex;

    const defaultAnswer = question.type === 'checkbox' ? [] : '';
    const finalAnswer = answer !== undefined ? answer : defaultAnswer;

    this.setData({
      currentQuestionIndex: index,
      currentQuestion: question,
      currentAnswer: finalAnswer,
      errorMessage: '',
      isLastQuestion: isLast
    });

    this.updateLastInteractionTime();
  },

  // 更新进度显示
  updateProgressDisplay: function() {
    const progress = this.data.progress;
    // 根据性别动态计算总题数
    const genderAnswer = this.data.answers[4];
    const isFemale = genderAnswer === 'B. 女性';
    const actualTotalQuestions = isFemale ? 33 : 31;
    const lastQuestionIndex = isFemale ? 32 : 30; // 女性:第33题(index 32), 男性:第31题(index 30)

    const percent = Math.round((progress / actualTotalQuestions) * 100);
    const isLast = this.data.currentQuestionIndex === lastQuestionIndex;

    // 根据进度百分比设置状态
    let progressStatus = 'low';
    if (percent >= 100) {
      progressStatus = 'complete';
    } else if (percent >= 80) {
      progressStatus = 'high';
    } else if (percent >= 50) {
      progressStatus = 'medium';
    }

    this.setData({
      progressPercent: percent,
      progressStatus: progressStatus,
      totalQuestions: actualTotalQuestions,  // 动态更新总题数
      isLastQuestion: isLast  // 更新是否是最后一题
    });
  },

  // 检查并更新进度
  checkAndUpdateProgress: function() {
    // 只计算真正填写的答案数量（排除空值）
    let answeredCount = 0;
    for (const key in this.data.answers) {
      const answer = this.data.answers[key];
      // 检查是否是有效答案
      if (answer !== undefined && answer !== null && answer !== '' &&
          !(Array.isArray(answer) && answer.length === 0)) {
        answeredCount++;
      }
    }

    const newProgress = answeredCount;

    if (newProgress !== this.data.progress) {
      this.setData({
        progress: newProgress
      });
      this.updateProgressDisplay();

      // 保存整个answers对象到本地存储
      StorageManager.updateAnswers(this.data.answers);
    }
  },

  // 输入框变化处理
  onInputChange: function(e) {
    const value = e.detail.value;
    console.log('输入框变化 - 题目ID:', this.data.currentQuestion.id, '题目:', this.data.currentQuestion.content, '值:', value);
    this.setData({
      currentAnswer: value
    });
    this.updateLastInteractionTime();
  },

  onTextareaChange: function(e) {
    const value = e.detail.value;
    console.log('文本域变化 - 题目ID:', this.data.currentQuestion.id, '题目:', this.data.currentQuestion.content, '值:', value);
    this.setData({
      currentAnswer: value
    });
    this.updateLastInteractionTime();
  },

  onInputBlur: function() {
    console.log('输入框失焦 - 题目ID:', this.data.currentQuestion.id, '当前答案:', this.data.currentAnswer);
    this.saveCurrentAnswer();
    this.validateCurrentAnswer();
  },

  // 单选选项选择
  onOptionSelect: function(e) {
    const value = e.currentTarget.dataset.value;
    const questionId = this.data.currentQuestion.id;

    this.setData({
      currentAnswer: value
    });
    this.saveCurrentAnswer();
    this.validateCurrentAnswer();
    this.updateLastInteractionTime();

    // 如果是性别题（ID=4），选择后立即更新进度显示
    if (questionId === 4) {
      this.updateProgressDisplay();
    }
  },

  // 多选选项选择
  onMultiOptionSelect: function(e) {
    const value = e.currentTarget.dataset.value;
    let currentAnswers = this.data.currentAnswer || [];

    if (!Array.isArray(currentAnswers)) {
      currentAnswers = [];
    }

    if (currentAnswers.includes(value)) {
      // 取消选择
      currentAnswers = currentAnswers.filter(item => item !== value);
    } else {
      // 添加选择
      currentAnswers.push(value);
    }

    this.setData({
      currentAnswer: currentAnswers
    });
    this.saveCurrentAnswer();
    this.validateCurrentAnswer();
    this.updateLastInteractionTime();
  },

  // 保存当前答案
  saveCurrentAnswer: function() {
    if (this.data.currentQuestion) {
      const questionId = this.data.currentQuestion.id;
      const answerValue = this.data.currentAnswer;

      console.log('保存答案 - 题目ID:', questionId, '题目:', this.data.currentQuestion.content, '答案:', answerValue);

      const newAnswers = { ...this.data.answers };
      newAnswers[questionId] = answerValue;

      console.log('保存后的answers对象:', newAnswers);

      this.setData({
        answers: newAnswers
      });

      // 更新本地存储
      StorageManager.updateAnswer(questionId, answerValue);
      this.checkAndUpdateProgress();
    }
  },

  // 验证当前答案
  validateCurrentAnswer: function() {
    if (!this.data.currentQuestion) return;
    
    // 清除之前的验证定时器
    if (this.data.validationTimer) {
      clearTimeout(this.data.validationTimer);
    }
    
    // 延迟验证，避免频繁请求
    const timer = setTimeout(() => {
      this.performValidation();
    }, 1000);
    
    this.setData({
      validationTimer: timer
    });
  },

  // 执行验证
  performValidation: function() {
    const validations = Validator.validateQuestion(
      this.data.currentQuestion,
      this.data.currentAnswer,
      this.data.answers,
      this.data.questionnaire
    );
    
    // 检查是否有错误
    const hasError = validations.some(v => !v.isValid);
    
    if (hasError) {
      const errorMessages = validations
        .filter(v => !v.isValid)
        .map(v => v.message)
        .join('；');
      
      this.setData({
        aiBubbleMessage: errorMessages
      });
    } else {
      // 验证通过，恢复默认提示
      this.setData({
        aiBubbleMessage: '填写正确，继续加油！'
      });
    }
    
    this.updateLastInteractionTime();
  },

  // 上一题
  onPrevQuestion: function() {
    if (this.data.currentQuestionIndex > 0) {
      this.saveCurrentAnswer();
      this.goToQuestion(this.data.currentQuestionIndex - 1);
    }
  },

  // 下一题/提交
  onNextQuestion: function() {
    this.saveCurrentAnswer();

    // 判断当前是否是最后一题(对于男性是第31题,index 30;对于女性是第33题,index 32)
    const genderAnswer = this.data.answers[4];
    const isFemale = genderAnswer === 'B. 女性';
    const lastQuestionIndex = isFemale ? 32 : 30; // 女性:第33题(index 32), 男性:第31题(index 30)

    if (this.data.currentQuestionIndex === lastQuestionIndex) {
      // 最后一题，执行提交
      this.submitQuestionnaire();
    } else {
      // 跳转到下一题
      let nextIndex = this.data.currentQuestionIndex + 1;

      // 性别联动逻辑：如果是男性，从第31题(index 30)直接跳到结束
      if (nextIndex === 31 || nextIndex === 32) {
        if (!isFemale) {
          nextIndex = 33; // 直接跳到结束(index 33, 超出范围)
        }
      }

      this.goToQuestion(nextIndex);
    }
  },

  // 判断是否是最后一题
  isLastQuestion: function() {
    const genderAnswer = this.data.answers[4];
    const isFemale = genderAnswer === 'B. 女性';
    const lastQuestionIndex = isFemale ? 32 : 30; // 女性:第33题(index 32), 男性:第31题(index 30)

    return this.data.currentQuestionIndex === lastQuestionIndex;
  },

  // 提交问卷
  submitQuestionnaire: function() {
    this.setData({
      isSubmitting: true
    });

    console.log('===== 提交问卷 =====');
    console.log('当前answers:', this.data.answers);
    console.log('答案数量:', Object.keys(this.data.answers).length);

    // 执行全量验证
    const validationResult = Validator.validateAll(this.data.questionnaire, this.data.answers);

    console.log('验证结果:', validationResult);

    if (!validationResult.isValid) {
      const errorMessage = Validator.formatValidationMessages(validationResult);
      console.log('验证失败，错误信息:', errorMessage);
      this.showError(errorMessage);
      this.setData({ isSubmitting: false });
      return;
    }

    console.log('验证通过，准备提交到云函数');

    // 调用云函数提交
    this.callSubmitCloudFunction();
  },

  // 调用云函数提交
  callSubmitCloudFunction: function() {
    const questionnaireData = StorageManager.getCompleteQuestionnaireData();

    console.log('从storage获取的问卷数据:', questionnaireData);
    console.log('提交的答案详情:', questionnaireData.answers);

    if (!questionnaireData) {
      console.error('提交数据异常：questionnaireData为空');
      this.showError('提交数据异常，请重试');
      this.setData({ isSubmitting: false });
      return;
    }

    wx.cloud.callFunction({
      name: 'interact',
      data: {
        eventType: 'submit',
        record_id: questionnaireData.record_id,
        allAnswers: questionnaireData.answers
      },
      success: (res) => {
        console.log('云函数调用成功:', res.result);
        if (res.result.success) {
          // 提交成功，跳转到结果页面
          StorageManager.clearQuestionnaire();
          wx.redirectTo({
            url: '/pages/result/result?recordId=' + questionnaireData.record_id
          });
        } else {
          console.error('云函数返回失败:', res.result.feedback);
          this.showError(res.result.feedback || '提交失败，请重试');
        }
        this.setData({ isSubmitting: false });
      },
      fail: (error) => {
        console.error('云函数调用失败：', error);
        this.showError('网络异常，请检查后重试');
        this.setData({ isSubmitting: false });
      }
    });
  },

  // AI助手相关功能
  toggleAIPanel: function() {
    this.setData({
      isAIPanelOpen: !this.data.isAIPanelOpen
    });
    this.updateLastInteractionTime();
  },

  onAIQuestionInput: function(e) {
    this.setData({
      aiQuestion: e.detail.value
    });
  },

  onQuickQuestion: function(e) {
    const question = e.currentTarget.dataset.question;
    this.setData({
      aiQuestion: question
    });
  },

  sendAIQuestion: function() {
    if (!this.data.aiQuestion.trim()) return;
    
    const question = this.data.aiQuestion.trim();
    
    // 添加到对话记录
    const newDialog = [...this.data.aiDialog, {
      role: 'user',
      content: question
    }];
    
    this.setData({
      aiDialog: newDialog,
      aiQuestion: ''
    });
    
    // 调用云函数获取AI回答
    this.callAIQuestionCloudFunction(question);
    this.updateLastInteractionTime();
  },

  callAIQuestionCloudFunction: function(question) {
    const questionnaireData = StorageManager.getCompleteQuestionnaireData();
    const currentQuestion = this.data.currentQuestion;

    // 构建包含当前题目信息的提示词（完整版，超时已放宽）
    let questionContext = '';
    if (currentQuestion) {
      // 传递完整的题目内容和选项信息
      questionContext = `\n\n【当前题目信息】\n第${currentQuestion.id}题：${currentQuestion.content}`;
      if (currentQuestion.options && currentQuestion.options.length > 0) {
        questionContext += '\n选项：';
        currentQuestion.options.forEach((opt, index) => {
          questionContext += `\n${opt}`;
        });
      }
    }

    const fullQuestion = question + questionContext;

    wx.cloud.callFunction({
      name: 'interact',
      data: {
        eventType: 'aiQuestion',
        record_id: questionnaireData?.record_id || 'temp',
        aiQuestion: fullQuestion
      },
      success: (res) => {
        if (res.result.success) {
          const aiAnswer = res.result.aiAnswer;
          const updatedDialog = [...this.data.aiDialog, {
            role: 'assistant',
            content: aiAnswer
          }];

          this.setData({
            aiDialog: updatedDialog
          });
        } else {
          this.showAIFallback(question);
        }
      },
      fail: (error) => {
        console.error('AI问答失败：', error);
        this.showAIFallback(question);
      }
    });
  },

  showAIFallback: function(question) {
    const fallbackAnswer = LLMFallback.getFallbackResponse('aiQuestion', { question });
    const updatedDialog = [...this.data.aiDialog, {
      role: 'assistant',
      content: fallbackAnswer.aiAnswer
    }];
    
    this.setData({
      aiDialog: updatedDialog
    });
  },

  // 定时器相关功能
  startEncouragementTimer: function() {
    const timer = setInterval(() => {
      this.checkForEncouragement();
    }, 10000); // 每10秒检查一次
    
    this.setData({
      encouragementTimer: timer
    });
  },

  checkForEncouragement: function() {
    const now = Date.now();
    const lastInteraction = this.data.lastInteractionTime;
    
    if (now - lastInteraction > 30000) { // 30秒无操作
      const encouragement = LLMFallback.generateEncouragement(this.data.progress, this.data.totalQuestions);
      this.setData({
        aiBubbleMessage: encouragement
      });
    }
  },

  updateLastInteractionTime: function() {
    this.setData({
      lastInteractionTime: Date.now()
    });
  },

  clearTimers: function() {
    if (this.data.encouragementTimer) {
      clearInterval(this.data.encouragementTimer);
    }
    if (this.data.validationTimer) {
      clearTimeout(this.data.validationTimer);
    }
  },

  // 工具函数
  showError: function(message) {
    this.setData({
      errorMessage: message
    });
    
    setTimeout(() => {
      this.setData({ errorMessage: '' });
    }, 5000);
  },

  preventTouchMove: function() {
    // 阻止触摸移动，用于AI面板
    return;
  },

  // AI图标拖动功能
  handleTouchStart: function(e) {
    console.log('Touch Start');
    this.dragging = true;
    this.isClick = true;  // 初始认为是点击
    this.touchStartTime = Date.now();  // 记录触摸开始时间
    this.touchStartTime2 = Date.now();  // 用于记录move开始时间
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
    this.startRight = this.data.aiIconRight;
    this.startBottom = this.data.aiIconBottom;
  },

  handleTouchMove: function(e) {
    if (!this.dragging) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;

    // 检查是否第一次move事件，如果是，记录时间
    if (!this.firstMoveTime) {
      this.firstMoveTime = Date.now();
    }

    const timeDiff = this.firstMoveTime - this.touchStartTime;

    // 如果触摸后100ms内开始移动，认为是拖动而不是点击
    if (timeDiff < 100) {
      this.isClick = false;
      console.log('Marked as drag (time based)', timeDiff);
    }

    const deltaX = this.startX - currentX;  // right值需要反方向计算
    const deltaY = this.startY - currentY;  // bottom值需要反方向计算

    // 使用缓存的屏幕尺寸（在onLoad时初始化）
    if (!this.screenInfo) {
      this.screenInfo = wx.getSystemInfoSync();
    }
    const screenWidth = this.screenInfo.windowWidth * 2;  // 转换为rpx
    const screenHeight = this.screenInfo.windowHeight * 2;  // 转换为rpx

    // 计算新的位置
    let newRight = this.startRight + deltaX;
    let newBottom = this.startBottom + deltaY;

    // 限制边界：图标宽120rpx，高120rpx
    const minRight = 0;
    const maxRight = screenWidth - 120;
    const minBottom = 0;
    const maxBottom = screenHeight - 120;

    // 确保不超出边界
    newRight = Math.max(minRight, Math.min(maxRight, newRight));
    newBottom = Math.max(minBottom, Math.min(maxBottom, newBottom));

    this.setData({
      aiIconRight: newRight,
      aiIconBottom: newBottom
    });
  },

  handleTouchEnd: function(e) {
    console.log('Touch End, isClick:', this.isClick);
    this.dragging = false;
    this.firstMoveTime = null;  // 重置首次移动时间

    // 使用缓存的屏幕尺寸
    if (!this.screenInfo) {
      this.screenInfo = wx.getSystemInfoSync();
    }
    const screenWidth = this.screenInfo.windowWidth * 2;
    const screenHeight = this.screenInfo.windowHeight * 2;

    const iconWidth = 120;
    const iconHeight = 120;

    // 判断更靠近哪个边缘（只考虑右边缘和底部边缘）
    const distanceToRight = this.data.aiIconRight;
    const distanceToBottom = this.data.aiIconBottom;

    // 比较距离，吸附到更近的边缘
    if (distanceToRight <= distanceToBottom) {
      // 吸附到右边缘
      this.setData({ aiIconRight: 0 });
    } else {
      // 吸附到底部
      this.setData({ aiIconBottom: 0 });
    }
  },

  // AI图标点击事件
  handleIconClick: function(e) {
    console.log('Click event, isClick:', this.isClick);
    // 只在没有拖动的情况下才触发点击
    if (this.isClick) {
      console.log('触发AI面板展开');
      this.toggleAIPanel();
    } else {
      console.log('这是拖动，不触发点击');
    }
  },
});