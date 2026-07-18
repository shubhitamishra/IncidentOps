const OnCallMember = require('../models/OnCallMember');

/**
 * Determines the current on-call member using a weekly rotation.
 * rotationOrder decides sequence; the week number (since epoch) decides
 * whose turn it is. This is deterministic and explainable:
 *   currentIndex = weekNumber % totalActiveMembers
 */
async function getCurrentOnCall() {
  const members = await OnCallMember.find({ active: true }).sort('rotationOrder');
  if (members.length === 0) return null;

  const now = new Date();
  const epochWeek = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
  const index = epochWeek % members.length;
  return members[index];
}

/**
 * Given a currently-assigned member, returns the next person in rotation
 * for escalation purposes.
 */
async function getNextInRotation(currentMemberId) {
  const members = await OnCallMember.find({ active: true }).sort('rotationOrder');
  if (members.length <= 1) return members[0] || null;

  const currentIndex = members.findIndex(m => m._id.toString() === currentMemberId.toString());
  const nextIndex = (currentIndex + 1) % members.length;
  return members[nextIndex];
}

module.exports = { getCurrentOnCall, getNextInRotation };
