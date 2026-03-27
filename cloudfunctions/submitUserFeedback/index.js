// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 处理用户反馈提交
 */
exports.main = async (event, context) => {
  const {
    group,
    session_id,
    user_id,
    questionnaire_id,
    satisfaction_score,
    recommendation_level,
    ai_comparison,
    ai_acceptance,
    submit_time
  } = event;

  console.log('[用户反馈云函数] 接收数据:', {
    group,
    session_id,
    user_id,
    questionnaire_id,
    satisfaction_score,
    recommendation_level,
    ai_comparison,
    ai_acceptance,
    submit_time
  });

  // 数据验证
  if (!group || !user_id || !satisfaction_score || !recommendation_level || !ai_comparison) {
    return {
      success: false,
      message: '缺少必要参数'
    };
  }

  // 验证满意度评分范围
  if (satisfaction_score < 1 || satisfaction_score > 10) {
    return {
      success: false,
      message: '满意度评分必须在1-10之间'
    };
  }

  // 验证选项值
  const validRecommendationLevels = ['A', 'B', 'C', 'D', 'E'];
  const validAiComparisonLevels = ['A', 'B', 'C', 'D', 'E'];
  const validAiAcceptanceLevels = ['A', 'B', 'C', 'D', 'E'];

  if (!validRecommendationLevels.includes(recommendation_level)) {
    return {
      success: false,
      message: '推荐意愿选项无效'
    };
  }

  if (!validAiComparisonLevels.includes(ai_comparison)) {
    return {
      success: false,
      message: 'AI功能比较选项无效'
    };
  }

  // 实验组必须填写AI接受度
  if (group === 'experimental' && !ai_acceptance) {
    return {
      success: false,
      message: '实验组必须填写AI接受度'
    };
  }

  if (group === 'experimental' && !validAiAcceptanceLevels.includes(ai_acceptance)) {
    return {
      success: false,
      message: 'AI接受度选项无效'
    };
  }

  try {
    // 生成反馈记录ID
    const feedbackId = 'feedback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // 准备插入的数据
    const feedbackData = {
      feedback_id: feedbackId,
      group: group,
      user_id: user_id,
      session_id: session_id || null,
      questionnaire_id: questionnaire_id || null,
      satisfaction_score: satisfaction_score,
      recommendation_level: recommendation_level,
      ai_comparison: ai_comparison,
      ai_acceptance: ai_acceptance || null, // 对照组为null
      submit_time: submit_time || Date.now(),
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    };

    console.log('[用户反馈云函数] 准备插入数据:', feedbackData);

    // 插入到user_feedback集合
    const result = await db.collection('user_feedback').add({
      data: feedbackData
    });

    console.log('[用户反馈云函数] 插入成功，记录ID:', result._id);

    // 同时更新user_sessions表中的反馈状态（如果session_id存在）
    if (session_id) {
      try {
        await db.collection('user_sessions').where({
          session_id: session_id
        }).update({
          data: {
            has_feedback: true,
            feedback_id: feedbackId,
            updated_at: db.serverDate()
          }
        });
        console.log('[用户反馈云函数] 更新user_sessions成功');
      } catch (sessionError) {
        console.warn('[用户反馈云函数] 更新user_sessions失败:', sessionError);
        // 不阻止主流程，继续执行
      }
    }

    return {
      success: true,
      feedback_id: feedbackId,
      message: '反馈提交成功'
    };

  } catch (error) {
    console.error('[用户反馈云函数] 处理失败:', error);
    return {
      success: false,
      message: error.message || '提交失败，请稍后重试'
    };
  }
};