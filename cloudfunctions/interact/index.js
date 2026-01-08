// 核心交互云函数 - 处理校验、LLM交互、提交等核心逻辑
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 智谱AI配置
const ZHIPU_AI_CONFIG = {
  apiKey: '6c34e08c70354384a0eb419fcccda5df.zARoajMrj6ij658N',
  apiSecret: '',
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  model: 'glm-4-flash' // 使用 GLM-4.5-Flash 模型
};

// 内置校验规则
const VALIDATION_RULES = {
  // 必填项校验
  required: (question, answer) => {
    if (!question.required) return null;
    if (answer === undefined || answer === null || answer === '') {
      return `请填写${question.content}`;
    }
    if (Array.isArray(answer) && answer.length === 0) {
      return `请选择${question.content}`;
    }
    return null;
  },
  
  // 数字类型校验
  number: (question, answer) => {
    if (question.type !== 'input_number') return null;
    if (!answer || answer === '') return null;
    
    const num = Number(answer);
    if (isNaN(num)) return '请输入有效数字';
    if (num < 0 || num > 120) return '请输入1-120之间的有效年龄';
    
    return null;
  },
  
  // 逻辑一致性校验
  logic: (questionId, currentAnswer, allAnswers) => {
    const checks = [];
    
    // 第3题性别选择联动校验
    if (questionId === 3) {
      const isFemale = currentAnswer === 'B. 女性';
      const q31 = allAnswers[31];
      const q32 = allAnswers[32];
      
      if (isFemale) {
        if (!q31 || !q32) {
          checks.push('性别选择为女性，需要填写后续相关问题');
        }
      } else {
        if (q31 || q32) {
          checks.push('性别选择为男性，无需填写女性专属问题');
        }
      }
    }
    
    // 第5题和第7题逻辑关联
    if (questionId === 5 || questionId === 7) {
      const q5Answers = allAnswers[5] || [];
      const q7Answers = allAnswers[7] || [];
      
      if (Array.isArray(q5Answers) && Array.isArray(q7Answers)) {
        const hasFamilyDiabetes = q5Answers.includes('E. 糖尿病');
        const hasSelfDiabetes = q7Answers.includes('E. 糖尿病');
        const hasFamilyNone = q5Answers.includes('U. 以上皆无');
        const hasSelfNone = q7Answers.includes('U. 以上皆无');
        
        if (hasFamilyDiabetes && !hasSelfDiabetes && !hasSelfNone) {
          checks.push('您填写家族有糖尿病史，但自身无，是否确认？');
        }
        
        if (hasSelfDiabetes && !hasFamilyDiabetes && !hasFamilyNone) {
          checks.push('您填写有糖尿病，但家族无相关病史，是否确认？');
        }
      }
    }
    
    // 第7题和第8题逻辑关联
    if (questionId === 7 || questionId === 8) {
      const q7Answers = allAnswers[7] || [];
      const q8Answers = allAnswers[8] || [];
      
      if (Array.isArray(q7Answers) && Array.isArray(q8Answers)) {
        const hasDiabetes = q7Answers.includes('E. 糖尿病');
        const hasDiabetesMed = q8Answers.includes('B. 降糖药');
        const hasMedNone = q8Answers.includes('G. 以上皆无');
        
        if (hasDiabetes && !hasDiabetesMed && !hasMedNone) {
          checks.push('您填写有糖尿病，但未填长期用药，是否确认？');
        }
      }
    }
    
    return checks.length > 0 ? checks : null;
  }
};

// 内置术语库（降级使用）
const TERM_LIBRARY = {
  "糖尿病": "血糖长期过高的一种慢性病，需要控制饮食和用药管理。",
  "高血压": "血压持续偏高的状况，会增加心脑血管疾病风险。",
  "冠心病": "心脏血管狭窄或堵塞导致的心脏病。",
  "脑卒中": "俗称中风，脑部血管突然破裂或堵塞。",
  "肥胖症": "体重明显超标，会增加多种疾病风险。"
};

/**
 * 主函数 - 处理各种交互事件
 */
async function main(event, context) {
  const { eventType, record_id, ...params } = event;

  try {
    switch (eventType) {
      case 'checkAnswer':
        return await handleCheckAnswer(params);

      case 'clickTerm':
        return await handleClickTerm(params);

      case 'submit':
        return await handleSubmit(record_id, params);

      case 'aiQuestion':
        return await handleAIQuestion(record_id, params);

      case 'generateHealthSummary':
        return await handleGenerateHealthSummary(params);

      default:
        return {
          success: false,
          message: '未知的事件类型'
        };
    }

  } catch (error) {
    console.error('交互处理失败：', error);

    // 降级处理
    return getFallbackResponse(eventType, params, error);
  }
}

/**
 * 处理答案校验
 */
async function handleCheckAnswer(params) {
  const { question, answer, allAnswers } = params;
  
  // 基本校验
  const requiredError = VALIDATION_RULES.required(question, answer);
  if (requiredError) {
    return {
      success: false,
      feedback: await generateLLMResponse('missing_reminder', { questionName: question.content }),
      fallback: false
    };
  }
  
  // 类型校验
  const typeError = VALIDATION_RULES.number(question, answer);
  if (typeError) {
    return {
      success: false,
      feedback: typeError,
      fallback: false
    };
  }
  
  // 逻辑校验
  const logicErrors = VALIDATION_RULES.logic(question.id, answer, allAnswers);
  if (logicErrors && logicErrors.length > 0) {
    return {
      success: false,
      feedback: logicErrors.join('；'),
      fallback: false
    };
  }
  
  // 校验通过
  return {
    success: true,
    feedback: '填写正确，继续加油！',
    fallback: false
  };
}

/**
 * 处理术语点击
 */
async function handleClickTerm(params) {
  const { terminology } = params;
  
  try {
    // 尝试调用LLM获取解释
    const explanation = await callZhipuAI(`请用通俗语言解释【${terminology}】，面向中老年糖尿病患者，核心定义≤25字，简单危害/注意事项≤30字，无专业术语叠加`);
    
    return {
      success: true,
      feedback: explanation,
      fallback: false
    };
    
  } catch (error) {
    // LLM调用失败，使用内置术语库
    const fallbackExplanation = TERM_LIBRARY[terminology] || 
      `关于${terminology}，建议咨询专业医护人员获取准确信息。（此为通用解释）`;
    
    return {
      success: true,
      feedback: fallbackExplanation,
      fallback: true
    };
  }
}

/**
 * 处理问卷提交
 */
async function handleSubmit(record_id, params) {
  const { allAnswers } = params;
  
  // 执行全量校验
  const validationResult = await validateAllAnswers(allAnswers);
  if (!validationResult.isValid) {
    return {
      success: false,
      feedback: validationResult.message,
      errorItems: validationResult.errors,
      fallback: false
    };
  }
  
  // 保存到数据库
  try {
    const saveResult = await db.collection('fill_record').add({
      data: {
        record_id: record_id,
        answers: allAnswers,
        submit_time: db.serverDate(),
        status: 'completed',
        create_time: db.serverDate()
      }
    });
    
    // 记录日志
    await db.collection('llm_log').add({
      data: {
        record_id: record_id,
        eventType: 'submit',
        content: '问卷提交成功',
        create_time: db.serverDate()
      }
    });
    
    return {
      success: true,
      feedback: '问卷提交成功！',
      fallback: false
    };
    
  } catch (error) {
    console.error('保存问卷失败：', error);
    
    // 保存失败，尝试降级存储
    try {
      await cloud.uploadFile({
        cloudPath: `questionnaire_backup/${record_id}.json`,
        fileContent: JSON.stringify({
          record_id,
          answers: allAnswers,
          submit_time: new Date().toISOString()
        })
      });
      
      return {
        success: true,
        feedback: '问卷提交成功（数据已备份）',
        fallback: true
      };
      
    } catch (backupError) {
      return {
        success: false,
        feedback: '提交失败，请重试',
        fallback: true
      };
    }
  }
}

/**
 * 处理AI问答
 */
async function handleAIQuestion(record_id, params) {
  const { aiQuestion } = params;

  try {
    // 记录问答日志（异步执行，不影响主流程）
    db.collection('llm_log').add({
      data: {
        record_id: record_id,
        eventType: 'aiQuestion',
        content: aiQuestion,
        response: 'pending',
        create_time: db.serverDate()
      }
    }).catch(err => console.log('日志记录失败:', err));

    const answer = await callZhipuAI(`用户提问：${aiQuestion}，请你通俗回答，面向中老年糖尿病患者，≤150字，无绝对化表述。`);

    // 更新日志
    db.collection('llm_log').where({
      record_id: record_id,
      eventType: 'aiQuestion',
      content: aiQuestion
    }).update({
      data: {
        response: answer,
        update_time: db.serverDate()
      }
    }).catch(err => console.log('日志更新失败:', err));

    return {
      success: true,
      aiAnswer: answer,
      fallback: false
    };

  } catch (error) {
    console.error('AI问答失败：', error);

    return {
      success: true,
      aiAnswer: await callZhipuAI(`用户提问：${aiQuestion}，通俗回答，面向中老年糖尿病患者，≤100字，无绝对化表述。`),
      fallback: false
    };
  }
}

/**
 * 处理健康摘要生成
 */
async function handleGenerateHealthSummary(params) {
  const { answers, prompt } = params;

  try {
    // 调用AI生成健康摘要
    const aiResponse = await callZhipuAI(`${prompt}\n\n请严格按照JSON格式输出，不要包含任何其他文字或标记。`);

    // 解析AI返回的JSON
    let healthData;
    try {
      // 尝试提取JSON部分
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        healthData = JSON.parse(jsonMatch[0]);
      } else {
        healthData = JSON.parse(aiResponse);
      }
    } catch (parseError) {
      console.error('解析AI响应失败:', parseError);
      throw new Error('AI响应格式错误');
    }

    return {
      success: true,
      healthHighlights: healthData.healthHighlights || [],
      generalAdvice: healthData.generalAdvice || '',
      fallback: false
    };

  } catch (error) {
    console.error('生成健康摘要失败:', error);

    return {
      success: false,
      error: error.message,
      fallback: true
    };
  }
}

/**
 * 调用智谱AI API
 */
async function callZhipuAI(prompt) {
  // 检查API配置
  if (!ZHIPU_AI_CONFIG.apiKey || ZHIPU_AI_CONFIG.apiKey === '' || ZHIPU_AI_CONFIG.apiKey === 'your-zhipu-api-key') {
    console.log('API Key未配置，使用模拟回答');
    // API未配置时返回模拟回答
    return getMockAIResponse(prompt);
  }

  console.log('使用真实AI API，模型:', ZHIPU_AI_CONFIG.model);
  
  try {
    // 实际调用智谱AI API
    const response = await new Promise((resolve, reject) => {
      const https = require('https');
      const url = require('url');

      const parsedUrl = url.parse(ZHIPU_AI_CONFIG.baseUrl);
      const postData = JSON.stringify({
        model: ZHIPU_AI_CONFIG.model || 'glm-4-flash',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      });
      
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ZHIPU_AI_CONFIG.apiKey}`
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            if (jsonData.choices && jsonData.choices[0] && jsonData.choices[0].message) {
              resolve(jsonData.choices[0].message.content);
            } else {
              reject(new Error('API响应格式错误'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
    
    return response;
  } catch (error) {
    console.error('调用智谱AI失败:', error);
    // 降级到模拟回答
    return getMockAIResponse(prompt);
  }
}

/**
 * 获取模拟AI回答
 */
function getMockAIResponse(prompt) {
  // 根据prompt中的关键词返回相关回答
  const keywordResponses = {
    '糖尿病': '糖尿病是血糖长期过高的慢性病，需要通过饮食控制、适量运动和规范用药来管理。建议定期监测血糖，遵医嘱调整治疗方案。',
    '血糖': '血糖是血液中的葡萄糖含量。空腹血糖正常值为3.9-6.1mmol/L，餐后2小时血糖应小于7.8mmol/L。保持规律作息和健康饮食有助于血糖稳定。',
    '饮食': '糖尿病患者饮食建议：1.定时定量，少食多餐；2.控制碳水化合物摄入；3.多吃蔬菜和全谷物；4.避免高糖高脂食物；5.戒烟限酒。',
    '运动': '适量运动有助于控制血糖：建议每周至少150分钟中等强度有氧运动，如快走、游泳等。运动前后注意监测血糖，避免低血糖发生。',
    '用药': '用药请遵医嘱，按时按量服用降糖药或注射胰岛素。不可自行调整剂量或停药。如有不适，及时就医调整治疗方案。',
    '并发症': '糖尿病常见并发症包括：视网膜病变、肾病、神经病变、心脑血管疾病等。定期体检、控制血糖可有效预防和延缓并发症发生。'
  };
  
  // 查找匹配的关键词
  for (const [keyword, response] of Object.entries(keywordResponses)) {
    if (prompt.includes(keyword)) {
      return response + '（仅为问卷辅助，不构成医疗建议）';
    }
  }
  
  // 默认回答
  const defaultResponses = [
    '这是一个很好的问题。建议您咨询专业医生获取个性化医疗建议。保持健康的生活方式对控制病情很重要。',
    '您的问题涉及专业医疗内容。建议定期体检，遵医嘱进行治疗和管理。如有任何不适，请及时就医。',
    '关于这个问题，不同个体情况可能不同。建议您向医护人员详细咨询，制定适合您的健康管理方案。'
  ];
  const randomResponse = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
  return randomResponse + '（仅为问卷辅助，不构成医疗建议）';
}

/**
 * 全量答案校验
 */
async function validateAllAnswers(allAnswers) {
  const errors = [];

  // 必填题ID列表：姓名(1)、手机号(2)、年龄(3)、性别(4)
  // 注意：第2题手机号的required为false，所以不需要校验
  const requiredQuestions = [1, 3, 4]; // 姓名、年龄、性别为必填

  for (const qid of requiredQuestions) {
    const answer = allAnswers[qid];
    if (!answer || answer === '') {
      errors.push(`第${qid}题`);
    }
    // 多选题检查是否为空数组
    if (Array.isArray(answer) && answer.length === 0) {
      errors.push(`第${qid}题`);
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      message: `请完成以下必填项：${errors.join('、')}`,
      errors: errors
    };
  }

  return { isValid: true, message: '' };
}

/**
 * 生成LLM响应
 */
async function generateLLMResponse(templateType, params) {
  const templates = {
    missing_reminder: (p) => `请填写${p.questionName}，这有助于医生更准确了解您的健康状况`,
    contradiction_query: (p) => `您之前选择"${p.previousAnswer}"，现在选择"${p.currentAnswer}"，请确认是否准确？`,
    encouragement: (p) => `已完成${p.progress}/${p.total}题，继续加油！`
  };
  
  const template = templates[templateType];
  return template ? template(params) : '请继续填写问卷';
}

/**
 * 降级响应
 */
function getFallbackResponse(eventType, params, error) {
  const fallbacks = {
    checkAnswer: {
      success: false,
      feedback: '校验暂不可用，请确认答案后继续',
      fallback: true
    },
    clickTerm: {
      success: true,
      feedback: TERM_LIBRARY[params.terminology] || '术语解释暂不可用',
      fallback: true
    },
    submit: {
      success: false,
      feedback: '提交服务暂不可用，请稍后重试',
      fallback: true
    },
    aiQuestion: {
      success: true,
      aiAnswer: '智能助手暂不可用，建议咨询医护人员',
      fallback: true
    }
  };
  
  return fallbacks[eventType] || {
    success: false,
    message: '服务暂时不可用',
    fallback: true
  };
}

// 导出主函数
exports.main = main;