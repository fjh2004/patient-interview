// 数据校验工具类
// 功能：问卷答案校验、逻辑一致性检查、输入验证

class Validator {
  // 必填项校验
  static validateRequired(question, answer) {
    if (!question.required) return { isValid: true, message: '' };
    
    if (answer === undefined || answer === null || answer === '') {
      return {
        isValid: false,
        message: `请填写${question.content}`
      };
    }
    
    // 对于多选和单选，检查是否选择了有效选项
    if (question.type === 'radio' || question.type === 'checkbox') {
      if (Array.isArray(answer) && answer.length === 0) {
        return {
          isValid: false,
          message: `请选择${question.content}`
        };
      }
      if (typeof answer === 'string' && answer.trim() === '') {
        return {
          isValid: false,
          message: `请选择${question.content}`
        };
      }
    }
    
    return { isValid: true, message: '' };
  }

  // 输入类型校验
  static validateInputType(question, answer) {
    if (!answer || answer === '') return { isValid: true, message: '' };
    
    switch (question.type) {
      case 'input_number':
        if (isNaN(Number(answer)) || answer.trim() === '') {
          return {
            isValid: false,
            message: '请输入有效数字'
          };
        }
        const num = Number(answer);
        if (num < 0 || num > 120) {
          return {
            isValid: false,
            message: '请输入1-120之间的有效年龄'
          };
        }
        break;
        
      case 'input_single':
      case 'input_multi':
        if (typeof answer !== 'string') {
          return {
            isValid: false,
            message: '请输入有效文本'
          };
        }
        break;
        
      default:
        break;
    }
    
    return { isValid: true, message: '' };
  }

  // 逻辑一致性校验
  static validateLogic(questionId, currentAnswer, allAnswers, questionnaire) {
    const checks = [];

    // 第4题性别选择联动校验（32、33题）
    if (questionId === 4) {
      const isFemale = currentAnswer === 'B. 女性';
      const q32 = allAnswers[32];
      const q33 = allAnswers[33];

      if (isFemale) {
        // 女性必须填写32、33题
        if (!q32 || !q33) {
          checks.push({
            isValid: false,
            message: '性别选择为女性，需要填写后续相关问题',
            relatedQuestions: [32, 33]
          });
        }
      } else {
        // 男性不能填写32、33题
        if (q32 || q33) {
          checks.push({
            isValid: false,
            message: '性别选择为男性，无需填写女性专属问题',
            relatedQuestions: [32, 33]
          });
        }
      }
    }
    
    // 第5题和第7题逻辑关联（家族史-自身患病一致性）
    if (questionId === 5 || questionId === 7) {
      const q5Answers = allAnswers[5] || [];
      const q7Answers = allAnswers[7] || [];
      
      // 检查是否有矛盾：家族有糖尿病但自身无
      if (Array.isArray(q5Answers) && Array.isArray(q7Answers)) {
        const hasFamilyDiabetes = q5Answers.includes('E. 糖尿病');
        const hasSelfDiabetes = q7Answers.includes('E. 糖尿病');
        const hasFamilyNone = q5Answers.includes('U. 以上皆无');
        const hasSelfNone = q7Answers.includes('U. 以上皆无');
        
        if (hasFamilyDiabetes && !hasSelfDiabetes && !hasSelfNone) {
          checks.push({
            isValid: false,
            message: '您填写家族有糖尿病史，但自身无，是否确认？',
            relatedQuestions: [5, 7]
          });
        }
        
        if (hasSelfDiabetes && !hasFamilyDiabetes && !hasFamilyNone) {
          checks.push({
            isValid: false,
            message: '您填写有糖尿病，但家族无相关病史，是否确认？',
            relatedQuestions: [5, 7]
          });
        }
      }
    }
    
    // 第7题和第8题逻辑关联（患病-用药一致性）
    if (questionId === 7 || questionId === 8) {
      const q7Answers = allAnswers[7] || [];
      const q8Answers = allAnswers[8] || [];
      
      if (Array.isArray(q7Answers) && Array.isArray(q8Answers)) {
        const hasDiabetes = q7Answers.includes('E. 糖尿病');
        const hasDiabetesMed = q8Answers.includes('B. 降糖药');
        const hasMedNone = q8Answers.includes('G. 以上皆无');
        
        if (hasDiabetes && !hasDiabetesMed && !hasMedNone) {
          checks.push({
            isValid: false,
            message: '您填写有糖尿病，但未填长期用药，是否确认？',
            relatedQuestions: [7, 8]
          });
        }
      }
    }
    
    // 多选框互斥逻辑（"以上皆无"与其他选项互斥）
    // 需要先获取question对象
    const question = questionnaire.questions.find(q => q.id === questionId);
    if (question && question.type === 'checkbox') {
      if (Array.isArray(currentAnswer)) {
        const hasNoneOption = currentAnswer.includes('U. 以上皆无') || 
                             currentAnswer.includes('G. 以上皆无') ||
                             currentAnswer.includes('F. 以上皆无') ||
                             currentAnswer.includes('H. 以上皆无');
        
        if (hasNoneOption && currentAnswer.length > 1) {
          checks.push({
            isValid: false,
            message: '选择"以上皆无"时不能同时选择其他选项',
            relatedQuestions: [questionId]
          });
        }
      }
    }
    
    return checks.length > 0 ? checks : [{ isValid: true, message: '' }];
  }

  // 单题完整校验
  static validateQuestion(question, answer, allAnswers, questionnaire) {
    const validations = [];
    
    // 必填校验
    const requiredCheck = this.validateRequired(question, answer);
    if (!requiredCheck.isValid) {
      validations.push(requiredCheck);
    }
    
    // 输入类型校验
    const typeCheck = this.validateInputType(question, answer);
    if (!typeCheck.isValid) {
      validations.push(typeCheck);
    }
    
    // 逻辑一致性校验（仅在必填和类型校验通过后进行）
    if (requiredCheck.isValid && typeCheck.isValid) {
      const logicChecks = this.validateLogic(question.id, answer, allAnswers, questionnaire);
      validations.push(...logicChecks);
    }
    
    return validations;
  }

  // 全量校验（用于提交前）
  static validateAll(questionnaire, answers) {
    const errors = [];
    const warnings = [];

    // 获取性别，用于判断是否需要校验女性专属题
    const genderAnswer = answers[4];
    const isFemale = genderAnswer === 'B. 女性';

    questionnaire.questions.forEach(question => {
      // 男性用户跳过女性专属题（32、33题）
      if (!isFemale && (question.id === 32 || question.id === 33)) {
        return;
      }

      const answer = answers[question.id];
      const validations = this.validateQuestion(question, answer, answers, questionnaire);

      validations.forEach(validation => {
        if (!validation.isValid) {
          if (validation.relatedQuestions && validation.relatedQuestions.length > 0) {
            // 逻辑错误作为警告
            warnings.push({
              questionId: question.id,
              message: validation.message,
              relatedQuestions: validation.relatedQuestions
            });
          } else {
            // 必填和类型错误作为错误
            errors.push({
              questionId: question.id,
              message: validation.message
            });
          }
        }
      });
    });

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings
    };
  }

  // 生成用户友好的错误消息
  static formatValidationMessages(validationResult) {
    if (validationResult.isValid) {
      return '';
    }

    const errorMessages = validationResult.errors.map(error =>
      `第${error.questionId}题：${error.message}`
    );

    const warningMessages = validationResult.warnings.map(warning =>
      `第${warning.questionId}题：${warning.message}`
    );

    let message = '';

    if (errorMessages.length > 0) {
      message += `请完成以下必填项：\n${errorMessages.join('\n')}`;
    }

    if (warningMessages.length > 0) {
      if (message) message += '\n\n';
      message += `请注意以下逻辑一致性：\n${warningMessages.join('\n')}`;
    }

    return message;
  }

  // 检查是否所有必填题都已填写
  static checkRequiredCompletion(questionnaire, answers) {
    const unansweredRequired = questionnaire.questions.filter(question => 
      question.required && 
      (answers[question.id] === undefined || 
       answers[question.id] === null || 
       answers[question.id] === '' ||
       (Array.isArray(answers[question.id]) && answers[question.id].length === 0))
    );
    
    return {
      completed: unansweredRequired.length === 0,
      unanswered: unansweredRequired.map(q => q.id)
    };
  }
}

module.exports = Validator;