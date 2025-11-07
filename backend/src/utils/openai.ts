/**
 * OpenAI API Utility - Optimized for Cost Efficiency
 * Uses GPT-3.5-turbo for cost-effective analysis
 */

interface AnalyzeIncidentParams {
  type: 'incident' | 'near_miss'
  description: string
  location: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  date: string
}

interface AnalysisResult {
  summary: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  recommendations: string[]
  severityAssessment: string
  followUpActions: string[]
  advice: string // Advice/suggestions based on description
}

/**
 * Analyze incident report using OpenAI API
 * Optimized for cost: Uses GPT-3.5-turbo with concise prompts
 */
export async function analyzeIncident(params: AnalyzeIncidentParams): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  // Import OpenAI dynamically to avoid issues if package not installed
  const { OpenAI } = await import('openai')
  const openai = new OpenAI({ apiKey })

  // Optimized prompt - concise to minimize tokens
  const systemPrompt = `You are an expert clinician specializing in workplace safety and occupational health. Analyze incident reports from a medical and clinical perspective. Provide professional clinical advice, assessment, and recommendations. Respond in JSON format:
{
  "summary": "Brief 2-sentence clinical summary",
  "riskLevel": "low|medium|high|critical",
  "recommendations": ["3-4 brief clinical recommendations"],
  "severityAssessment": "One sentence clinical assessment of severity",
  "followUpActions": ["2-3 specific clinical follow-up actions"],
  "advice": "Expert clinician advice and medical recommendations based on the description (2-3 sentences)"
}`

  const userPrompt = `As an expert clinician, analyze this workplace incident report:

Report Type: ${params.type === 'incident' ? 'Incident' : 'Near-Miss'}
Severity: ${params.severity.toUpperCase()}
Date: ${params.date}
Location: ${params.location}
Description: ${params.description}

Provide your clinical assessment, medical recommendations, and professional advice.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Cost-effective model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3, // Lower temperature for consistent, focused responses
      max_tokens: 500, // Limit tokens to control cost
      response_format: { type: 'json_object' } // Force JSON for structured response
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    // Parse JSON response
    const analysis = JSON.parse(content) as AnalysisResult

    // Validate and sanitize response
    return {
      summary: analysis.summary || 'Analysis completed',
      riskLevel: ['low', 'medium', 'high', 'critical'].includes(analysis.riskLevel?.toLowerCase())
        ? analysis.riskLevel.toLowerCase() as 'low' | 'medium' | 'high' | 'critical'
        : params.severity,
      recommendations: Array.isArray(analysis.recommendations) 
        ? analysis.recommendations.slice(0, 4) // Limit to 4 recommendations
        : ['Conduct clinical assessment with healthcare provider', 'Monitor for signs of injury or complications', 'Follow workplace safety protocols'],
      severityAssessment: analysis.severityAssessment || 'Clinical assessment pending - please review severity classification',
      followUpActions: Array.isArray(analysis.followUpActions)
        ? analysis.followUpActions.slice(0, 3) // Limit to 3 actions
        : ['Notify clinical supervisor', 'Document incident for medical review', 'Monitor worker condition'],
      advice: analysis.advice || 'As a clinician, I recommend immediate medical evaluation if any injuries are present. Ensure proper documentation for clinical follow-up.'
    }
  } catch (error: any) {
    console.error('[OpenAI Analysis] Error:', error)
    
    // Return fallback analysis if API fails
    return {
      summary: 'Unable to complete clinical analysis. Please have a clinician review the incident manually.',
      riskLevel: params.severity,
      recommendations: [
        'Schedule clinical assessment with healthcare provider',
        'Monitor for any signs of injury or complications',
        'Ensure all safety protocols were followed',
        'Document incident for medical review'
      ],
      severityAssessment: `Clinical assessment needed - Reported severity: ${params.severity.toUpperCase()}`,
      followUpActions: [
        'Notify clinical supervisor immediately',
        'Complete incident documentation for medical review',
        'Schedule follow-up clinical assessment'
      ],
      advice: 'As a clinician, I recommend immediate medical evaluation if any injuries occurred. Ensure proper clinical documentation and follow workplace safety protocols.'
    }
  }
}

