// Mock YouCam AI Skin Analysis result, shaped like the real task response
// so the rest of the app cannot tell the difference.
// Scores run from 0 to 100. Higher means that concern is in better shape.
const MOCK_RESULT = {
  status: "success",
  data: {
    task_id: "mock-task-0001",
    task_status: "success",
    results: [
      { action: "moisture", score: 42 },
      { action: "oiliness", score: 68 },
      { action: "acne", score: 55 },
      { action: "radiance", score: 48 },
      { action: "texture", score: 61 },
      { action: "pore", score: 57 },
      { action: "redness", score: 74 },
      { action: "wrinkle", score: 82 }
    ]
  }
};

module.exports = { MOCK_RESULT };
