// 问卷填写页面逻辑 - 对照组（无LLM功能）
const StorageManager = require('../../utils/storage.js');
const Validator = require('../../utils/validator.js');
const Logger = require('../../utils/logger.js');

// 预制问卷数据（32道题完整配置）
const QUESTIONNAIRE_TEMPLATE = {
  "title": "糖尿病体检前健康问卷",
  "questions": [
    {"id":1,"content":"姓名","type":"input_single","placeholder":"请输入您的姓名","required":true,"rule":""},
    {"id":2,"content":"手机号","type":"input_single","placeholder":"无则不填","required":false,"rule":""},
    {"id":3,"content":"年龄","type":"input_number","placeholder":"请输入实际年龄，如：56","required":true,"rule":""},
    {"id":4,"content":"性别","type":"radio","options":["A. 男性","B. 女性"],"required":true,"rule":"关联32/33题，仅女性显示"},
    {"id":5,"content":"您的受教育程度","type":"radio","options":["A. 未受过教育","B. 小学","C. 初中","D. 高中","E. 大学及以上"],"required":true,"rule":"适配语言表述（低学历用通俗语）"},
    {"id":6,"content":"您的父母或兄弟姐妹是否患有以下明确诊断的疾病？","type":"checkbox","options":["A. 高血压","B. 脑卒中","C. 冠心病","D. 外周血管病","E. 糖尿病","F. 肥胖症","G. 慢性肾脏疾病","H. 慢性阻塞性肺病","I. 骨质疏松","J. 肺癌","K. 肝癌","L. 胃癌","M. 食管癌","N. 结直肠癌","O. 乳腺癌","P. 胰腺癌","Q. 宫颈癌","R. 前列腺癌","S. 甲状腺癌","T. 其他疾病","U. 以上皆无"],"required":true,"rule":"与7题逻辑关联（家族史-自身患病一致性）"},
    {"id":7,"content":"您的父亲是否在 55 岁之前或母亲在 65 岁之前患有冠心病？","type":"radio","options":["A. 是","B. 否"],"required":true,"rule":""},
    {"id":8,"content":"您是否患有以下明确诊断的疾病？","type":"checkbox","options":["A. 高血压","B. 脑卒中","C. 冠心病","D. 外周血管病","E. 糖尿病","F. 肥胖症","G. 慢性肾脏疾病","H. 慢性阻塞性肺病","I. 骨质疏松","J. 肺癌","K. 肝癌","L. 胃癌","M. 食管癌","N. 结直肠癌","O. 乳腺癌","P. 胰腺癌","Q. 宫颈癌","R. 前列腺癌","S. 甲状腺癌","T. 其他疾病","U. 以上皆无"],"required":true,"rule":"与5/8题逻辑关联"},
    {"id":9,"content":"您是否长期服用药物或营养素？(连续服用 6 个月以上，平均每日服用一次以上)","type":"checkbox","options":["A. 降压药","B. 降糖药","C. 降脂药","D. 降尿酸药","E. 抗心律失常药","F. 其他","G. 以上皆无"],"required":true,"rule":"与7题逻辑关联（患病-用药一致性）"},
    {"id":10,"content":"您对什么物质过敏？","type":"checkbox","options":["A. 青霉素","B. 磺胺类","C. 链霉素","D. 头孢类","E. 其他","F. 以上皆无"],"required":true,"rule":""},
    {"id":11,"content":"您是否因疾病进行过手术治疗？","type":"checkbox","options":["A. 头颅 (含脑)","B. 胸部 (含肺部)","C. 心脏 (含心脏介入)","D. 胃肠","E. 肝胆","F. 肾脏","G. 其它部位","H. 以上皆无"],"required":true,"rule":""},
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
    // 分组标识
    group: 'control',

    // 问卷相关数据
    questionnaire: QUESTIONNAIRE_TEMPLATE,
    currentQuestionIndex: 0,
    currentQuestion: null,
    currentAnswer: null,
    answers: {},
    progress: 0,
    totalQuestions: 33,
    progressPercent: 0,
    progressStatus: 'low',
    isLastQuestion: false,

    // UI状态
    isLoading: false,
    errorMessage: '',
    isSubmitting: false,
    isSubmitted: false,  // 是否已提交（用于判断是否中途退出）
    logger: null  // 日志记录器
  },

  onLoad: function(options) {
    // 检查并清理过期会话
    Logger.checkAndCleanExpiredSessions();

    // 检查是否有未完成的会话需要恢复
    const lastExitInfo = StorageManager.getLastExitInfo();
    const currentSessionId = StorageManager.getCurrentSessionId();
    
    console.log('[会话] 页面加载，检查会话状态:', {
      lastExitInfo: !!lastExitInfo,
      currentSessionId: currentSessionId
    });

    // 初始化日志记录器
    const logger = new Logger(this);
    this.setData({ logger: logger });

    // 如果有未完成的会话且会话ID匹配，恢复会话
    if (lastExitInfo && lastExitInfo.session_id === logger.sessionId) {
      console.log('[会话] 会话恢复，上次退出题号:', lastExitInfo.exit_question_index);
      
      // 恢复答案
      if (lastExitInfo.answers) {
        this.setData({
          answers: lastExitInfo.answers
        });
      }
      
      // 尝试恢复会话
      logger.logSessionResume().then(result => {
        console.log('[会话] 会话恢复结果:', result);
      });
    } else {
      // 记录新会话开始
      logger.logSessionStart();
    }

    this.initQuestionnaire();
  },

  onShow: function() {
    this.checkAndUpdateProgress();
  },

  // 页面卸载
  onUnload: function() {
    // 记录中途退出
    const { logger, currentQuestionIndex, answers } = this.data;

    // 只有在未提交的情况下才记录为abandoned
    const isSubmitted = this.data.isSubmitted === true;

    if (logger && !isSubmitted && currentQuestionIndex >= 0) {
      const answeredIds = Object.keys(answers);
      let hasSkip = false;
      const userId = logger ? logger.getUserId() : 'unknown';
      
      // 动态计算应显示的所有必填题
      const genderAnswer = answers[4];
      const isFemale = genderAnswer === 'B. 女性';
      
      const requiredQuestionIds = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      
      // 添加生活习惯题目（12-21）
      for (let i = 12; i <= 21; i++) {
        requiredQuestionIds.push(i);
      }
      
      // 添加近期症状题目（22-30）
      for (let i = 22; i <= 30; i++) {
        requiredQuestionIds.push(i);
      }
      
      // 如果是女性，添加专属题目
      if (isFemale) {
        requiredQuestionIds.push(32, 33);
      }
      
      console.log(`[debug] [${userId}] 中途退出检查 - 应显示的必填题:`, requiredQuestionIds);
      
      // 检查必填题是否有未填写的
      for (const qid of requiredQuestionIds) {
        if (!answeredIds.includes(String(qid))) {
          hasSkip = true;
          console.log(`[debug] [${userId}] 中途退出漏填必填题: 第${qid}题`);
          break;
        }
      }

      // 记录中途退出，exitQuestionIndex为当前题目索引，isExitEvent=true表示是退出事件
      logger.logSessionEnd('abandoned', currentQuestionIndex, hasSkip, true);
    }
  },

  // 初始化问卷
  initQuestionnaire: function() {
    const savedData = StorageManager.getQuestionnaire();

    if (savedData) {
      const answerKeys = Object.keys(savedData.answers || {});
      const hasOldFormat = answerKeys.some(key => !isNaN(key) && parseInt(key) >= 0 && parseInt(key) < 10);

      if (hasOldFormat) {
        StorageManager.clearQuestionnaire();
        const userInfo = StorageManager.getUserInfo() || {};
        const recordId = StorageManager.createNewQuestionnaire(userInfo, QUESTIONNAIRE_TEMPLATE);
        if (recordId) {
          this.goToQuestion(0);
        } else {
          this.showError('初始化问卷失败，请重试');
        }
      } else {
        this.setData({
          answers: savedData.answers || {},
          progress: savedData.progress || 0,
          questionnaire: savedData.template || QUESTIONNAIRE_TEMPLATE
        });
        const currentIndex = Math.min(savedData.progress, this.data.totalQuestions - 1);
        this.goToQuestion(currentIndex);
      }
    } else {
      const userInfo = StorageManager.getUserInfo() || {};
      const recordId = StorageManager.createNewQuestionnaire(userInfo, QUESTIONNAIRE_TEMPLATE);
      if (recordId) {
        this.goToQuestion(0);
      } else {
        this.showError('初始化问卷失败，请重试');
      }
    }

    this.updateProgressDisplay();
  },

  // 跳转到指定题目
  goToQuestion: function(index) {
    if (index < 0 || index > this.data.totalQuestions) return;

    const question = this.data.questionnaire.questions[index];
    if (!question) return;

    const answer = this.data.answers[question.id];

    // 性别联动逻辑：如果是男性，跳过32、33题
    if (question.id === 32 || question.id === 33) {
      const genderAnswer = this.data.answers[4];
      if (genderAnswer !== 'B. 女性') {
        if (index === 31) this.goToQuestion(32);
        if (index === 32) this.goToQuestion(33);
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

    // 记录题目开始时间
    const { logger } = this.data;
    if (logger) {
      logger.recordQuestionStartTime(question.id);
    }

    this.setData({
      currentQuestionIndex: index,
      currentQuestion: question,
      currentAnswer: finalAnswer,
      errorMessage: '',
      isLastQuestion: isLast
    });
  },

  // 更新进度显示
  updateProgressDisplay: function() {
    const progress = this.data.progress;
    const genderAnswer = this.data.answers[4];
    const isFemale = genderAnswer === 'B. 女性';
    const actualTotalQuestions = isFemale ? 33 : 31;
    const lastQuestionIndex = isFemale ? 32 : 30;

    const percent = Math.round((progress / actualTotalQuestions) * 100);
    const isLast = this.data.currentQuestionIndex === lastQuestionIndex;

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
      totalQuestions: actualTotalQuestions,
      isLastQuestion: isLast
    });
  },

  // 检查并更新进度
  checkAndUpdateProgress: function() {
    let answeredCount = 0;
    for (const key in this.data.answers) {
      const answer = this.data.answers[key];
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
      StorageManager.updateAnswers(this.data.answers);
    }
  },

  // 输入框变化处理
  onInputChange: function(e) {
    const value = e.detail.value;
    this.setData({
      currentAnswer: value
    });
  },

  onTextareaChange: function(e) {
    const value = e.detail.value;
    this.setData({
      currentAnswer: value
    });
  },

  onInputBlur: function() {
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
      currentAnswers = currentAnswers.filter(item => item !== value);
    } else {
      currentAnswers.push(value);
    }

    this.setData({
      currentAnswer: currentAnswers
    });
    this.saveCurrentAnswer();
    this.validateCurrentAnswer();
  },

  // 保存当前答案
  saveCurrentAnswer: function() {
    if (this.data.currentQuestion) {
      const questionId = this.data.currentQuestion.id;
      const answerValue = this.data.currentAnswer;

      const newAnswers = { ...this.data.answers };
      newAnswers[questionId] = answerValue;

      this.setData({
        answers: newAnswers
      });

      StorageManager.updateAnswer(questionId, answerValue);
      this.checkAndUpdateProgress();

      // 答案已自动保存，无需额外记录（答案在提交时保存到 fill_record）
    }
  },

  // 验证当前答案（基础验证，无LLM）
  validateCurrentAnswer: function() {
    const validations = Validator.validateQuestion(
      this.data.currentQuestion,
      this.data.currentAnswer,
      this.data.answers,
      this.data.questionnaire
    );

    const hasError = validations.some(v => !v.isValid);

    if (hasError) {
      const errorMessages = validations
        .filter(v => !v.isValid)
        .map(v => v.message)
        .join('；');

      this.setData({
        errorMessage: errorMessages
      });
    } else {
      this.setData({
        errorMessage: ''
      });
    }
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

    const genderAnswer = this.data.answers[4];
    const isFemale = genderAnswer === 'B. 女性';
    const lastQuestionIndex = isFemale ? 32 : 30;

    if (this.data.currentQuestionIndex === lastQuestionIndex) {
      this.submitQuestionnaire();
    } else {
      let nextIndex = this.data.currentQuestionIndex + 1;

      if (nextIndex === 31 || nextIndex === 32) {
        if (!isFemale) {
          nextIndex = 33;
        }
      }

      this.goToQuestion(nextIndex);
    }
  },

  // 提交问卷
  submitQuestionnaire: function() {
    this.setData({
      isSubmitting: true
    });

    const validationResult = Validator.validateAll(this.data.questionnaire, this.data.answers);

    if (!validationResult.isValid) {
      const errorMessage = Validator.formatValidationMessages(validationResult);
      this.showError(errorMessage);
      this.setData({ isSubmitting: false });
      return;
    }

    // 记录会话结束（简化版）
    const { logger } = this.data;

    // 计算是否有跳过（漏填必填项）
    const answeredIds = Object.keys(this.data.answers);
    let hasSkip = false;
    let hasUnfilledRequired = false;
    const userId = this.data.logger ? this.data.logger.getUserId() : 'unknown';
    
    console.log(`[debug] [${userId}] 答案列表:`, answeredIds);
    console.log(`[debug] [${userId}] 答案详情:`, this.data.answers);
    
    // 动态计算应显示的所有必填题
    const genderAnswer = this.data.answers[4];
    const isFemale = genderAnswer === 'B. 女性';
    
    // 必填题ID列表：总共30个必填题
    // 1. 基本信息必填题：1, 3, 4, 5 (4题)

    // 2. 家族病史必填题：6, 7 (2题)

    // 3. 个人病史必填题：8 (1题)

    // 4. 长期用药必填题：9 (1题)

    // 5. 过敏情况必填题：10 (1题)

    // 6. 手术史必填题：11 (1题)

    // 7. 生活习惯必填题：12-21 (10题)

    // 8. 近期症状必填题：22-30 (9题)

    // 9. 女性专属必填题：32, 33 (2题，仅限女性)

    const requiredQuestionIds = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    
    // 添加生活习惯题目（12-21）
    for (let i = 12; i <= 21; i++) {
      requiredQuestionIds.push(i);
    }
    
    // 添加近期症状题目（22-30）
    for (let i = 22; i <= 30; i++) {
      requiredQuestionIds.push(i);
    }
    
    // 如果是女性，添加专属题目
    if (isFemale) {
      requiredQuestionIds.push(32, 33);
    }
    
    console.log(`[debug] [${userId}] 应显示的必填题ID:`, requiredQuestionIds);
    console.log(`[debug] [${userId}] 用户已填写的必填题:`, answeredIds);
    
    // 检查必填题是否有未填写的
    for (const qid of requiredQuestionIds) {
      if (!answeredIds.includes(String(qid))) {
        hasUnfilledRequired = true;
        hasSkip = true;
        console.log(`[debug] [${userId}] 漏填必填题: 第${qid}题`, {
          应填总题数: requiredQuestionIds.length,
          已填数量: answeredIds.length,
          漏填题号: qid
        });
      }
    }
    
    console.log(`[debug] [${userId}] hasSkip最终值:`, hasSkip);

    if (logger) {
      // 正常完成，exitQuestionIndex为null，isExitEvent=false表示不是退出事件
      logger.logSessionEnd('completed', null, hasSkip, false);
    }

    this.callSubmitCloudFunction();
  },

  // 调用云函数提交
  callSubmitCloudFunction: function() {
    const questionnaireData = StorageManager.getCompleteQuestionnaireData();

    if (!questionnaireData) {
      this.showError('提交数据异常，请重试');
      this.setData({ isSubmitting: false });
      return;
    }

    wx.cloud.callFunction({
      name: 'interact',
      data: {
        eventType: 'submit',
        record_id: questionnaireData.record_id,
        allAnswers: questionnaireData.answers,
        group: 'control'
      },
      success: (res) => {
        if (res.result.success) {
          // 标记为已提交
          this.setData({ isSubmitted: true });

          StorageManager.clearQuestionnaire();
          wx.redirectTo({
            url: '/pages/result/result?recordId=' + questionnaireData.record_id + '&group=control'
          });
        } else {
          this.showError(res.result.feedback || '提交失败，请重试');
        }
        this.setData({ isSubmitting: false });
      },
      fail: (error) => {
        this.showError('网络异常，请检查后重试');
        this.setData({ isSubmitting: false });
      }
    });
  },

  // 工具函数
  showError: function(message) {
    this.setData({
      errorMessage: message
    });

    setTimeout(() => {
      this.setData({ errorMessage: '' });
    }, 5000);
  }
});

module.exports.QUESTIONNAIRE_TEMPLATE = QUESTIONNAIRE_TEMPLATE;
