// LLM降级处理工具类
// 功能：LLM接口异常时的默认回复、术语库管理、智能降级

// 内置医学术语库（当LLM不可用时使用）
const TERM_LIBRARY = {
  // 糖尿病相关术语
  "糖尿病": "血糖长期过高的一种慢性病，需要控制饮食和用药管理",
  "高血压": "血压持续偏高的状况，会增加心脑血管疾病风险",
  "冠心病": "心脏血管狭窄或堵塞导致的心脏病",
  "脑卒中": "俗称中风，脑部血管突然破裂或堵塞",
  "肥胖症": "体重明显超标，会增加多种疾病风险",
  "慢性肾脏疾病": "肾脏功能逐渐减退的长期疾病",
  "慢性阻塞性肺病": "肺部气流受限的慢性炎症，常见于吸烟者",
  "骨质疏松": "骨骼变脆易骨折的状况",
  
  // 药物术语
  "降压药": "用于控制血压的药物",
  "降糖药": "用于降低血糖的药物，如胰岛素等",
  "降脂药": "用于降低血液中脂肪含量的药物",
  "降尿酸药": "用于控制尿酸水平的药物",
  "抗心律失常药": "用于调节心跳规律的药物",
  
  // 症状术语
  "咳嗽": "呼吸道受刺激产生的反射动作",
  "咳痰": "咳嗽时排出呼吸道分泌物",
  "鼻出血": "鼻腔血管破裂导致的出血",
  "吞咽不适": "吃东西时感觉卡住或疼痛",
  "胸痛": "胸部区域的疼痛感",
  "呼吸困难": "感觉呼吸费力或气不够用",
  "恶心": "想呕吐的不适感",
  "反酸": "胃酸反流到食管的感觉",
  "消瘦": "体重不明原因明显下降",
  
  // 检查项目术语
  "手机号": "用户联系电话号码",
  "血糖控制": "通过饮食、运动和药物维持血糖在正常范围",
  "视力模糊": "看东西不清楚，可能是糖尿病并发症"
};

// 默认回答模板
const DEFAULT_RESPONSES = {
  // 术语解释默认回复
  termExplanation: (term) => {
    const defaultExplanation = TERM_LIBRARY[term] || `关于${term}，建议咨询专业医护人员获取准确信息`;
    return `${defaultExplanation}（此为通用解释，具体情况请咨询医生）`;
  },
  
  // 漏填提醒默认文案
  missingReminder: (questionName) => {
    const reminders = [
      `请填写${questionName}，这有助于医生更准确了解您的健康状况`,
      `完成${questionName}的填写，能让健康评估更全面`,
      `${questionName}是重要信息，请抽空填写一下`
    ];
    return reminders[Math.floor(Math.random() * reminders.length)];
  },
  
  // 矛盾追问默认文案
  contradictionQuery: (previousAnswer, currentAnswer) => {
    return `您之前选择"${previousAnswer}"，现在选择"${currentAnswer}"，请确认是否准确？`;
  },
  
  // 填写鼓励默认文案
  encouragement: (progress, total) => {
    const encouragements = [
      `已完成${progress}/${total}题，继续加油！`,
      `进度${Math.round(progress/total*100)}%，坚持就是胜利！`,
      `还剩${total-progress}题就完成了，加油！`,
      `填写得很认真，继续保持！`
    ];
    return encouragements[Math.floor(Math.random() * encouragements.length)];
  },
  
  // AI助手回答默认文案
  aiAnswer: (question) => {
    const medicalKeywords = ['糖尿病', '血糖', '胰岛素', '并发症', '用药', '饮食'];
    const hasMedicalTerm = medicalKeywords.some(keyword => question.includes(keyword));
    
    if (hasMedicalTerm) {
      return `关于${question}，这涉及专业医疗知识。建议您咨询医生获取个性化建议。平时注意规律作息、健康饮食对控制病情有帮助。`;
    } else {
      return `您的问题"${question}"已收到。由于涉及医疗健康信息，建议您咨询专业医护人员获取准确指导。填写问卷时如有疑问，可以随时问我。`;
    }
  },
  
  // 错误提示默认文案
  errorFallback: (errorType) => {
    const fallbacks = {
      'network': '网络连接不稳定，请检查网络后重试',
      'timeout': '请求超时，请稍后再试',
      'llm_error': '智能助手暂时不可用，您可以继续填写问卷',
      'general': '服务暂时不可用，请稍后重试'
    };
    return fallbacks[errorType] || fallbacks['general'];
  }
};

class LLMFallback {
  // 检查是否应该使用降级策略
  static shouldUseFallback(error) {
    if (!error) return false;
    
    // 网络错误
    if (error.errMsg && error.errMsg.includes('request:fail')) {
      return true;
    }
    
    // 超时错误
    if (error.errMsg && error.errMsg.includes('timeout')) {
      return true;
    }
    
    // LLM API错误
    if (error.code && [400, 401, 429, 500].includes(error.code)) {
      return true;
    }
    
    // 响应数据异常
    if (error.data && error.data.error) {
      return true;
    }
    
    return false;
  }

  // 获取降级响应
  static getFallbackResponse(eventType, params = {}) {
    switch (eventType) {
      case 'clickTerm':
        return {
          success: true,
          feedback: DEFAULT_RESPONSES.termExplanation(params.terminology),
          aiAnswer: '',
          fallback: true
        };
        
      case 'checkAnswer':
        if (params.missingField) {
          return {
            success: false,
            feedback: DEFAULT_RESPONSES.missingReminder(params.missingField),
            aiAnswer: '',
            fallback: true
          };
        } else if (params.contradiction) {
          return {
            success: false,
            feedback: DEFAULT_RESPONSES.contradictionQuery(
              params.previousAnswer, 
              params.currentAnswer
            ),
            aiAnswer: '',
            fallback: true
          };
        }
        break;
        
      case 'submit':
        return {
          success: false,
          feedback: '提交校验暂时不可用，请确认所有必填项已填写后再次提交',
          errorItems: [],
          fallback: true
        };
        
      case 'aiQuestion':
        return {
          success: true,
          feedback: '',
          aiAnswer: DEFAULT_RESPONSES.aiAnswer(params.question),
          fallback: true
        };
        
      default:
        return {
          success: false,
          feedback: DEFAULT_RESPONSES.errorFallback('general'),
          fallback: true
        };
    }
    
    return {
      success: false,
      feedback: '服务暂时不可用',
      fallback: true
    };
  }

  // 生成鼓励语（不依赖LLM）
  static generateEncouragement(progress, total) {
    return DEFAULT_RESPONSES.encouragement(progress, total);
  }

  // 获取术语库中的术语解释
  static getTermExplanation(term) {
    return TERM_LIBRARY[term] || null;
  }

  // 检查术语是否在术语库中
  static hasTermExplanation(term) {
    return TERM_LIBRARY.hasOwnProperty(term);
  }

  // 添加自定义术语到术语库（运行时扩展）
  static addCustomTerm(term, explanation) {
    if (term && explanation) {
      TERM_LIBRARY[term] = explanation;
      return true;
    }
    return false;
  }

  // 获取所有可用术语
  static getAllTerms() {
    return Object.keys(TERM_LIBRARY);
  }

  // 生成错误报告（用于调试）
  static generateErrorReport(error, context) {
    return {
      timestamp: new Date().toISOString(),
      errorType: this.classifyError(error),
      errorMessage: error.errMsg || error.message || JSON.stringify(error),
      context: context,
      fallbackUsed: true
    };
  }

  // 错误分类
  static classifyError(error) {
    if (error.errMsg && error.errMsg.includes('request:fail')) {
      return 'network_error';
    }
    if (error.errMsg && error.errMsg.includes('timeout')) {
      return 'timeout_error';
    }
    if (error.code && [400, 401].includes(error.code)) {
      return 'authentication_error';
    }
    if (error.code && error.code === 429) {
      return 'rate_limit_error';
    }
    if (error.code && error.code >= 500) {
      return 'server_error';
    }
    return 'unknown_error';
  }
}

module.exports = LLMFallback;