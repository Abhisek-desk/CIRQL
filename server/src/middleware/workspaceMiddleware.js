import Workspace from "../models/Workspace.js";

export const requireWorkspaceMember = async (
  req,
  res,
  next
) => {
  try {
    const workspace = await Workspace.findById(
      req.params.workspaceId
    );

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    const membership = workspace.members.find(
      (member) =>
        member.userId.toString() === req.user._id.toString()
    );

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this workspace",
      });
    }

    req.workspace = workspace;
    req.membership = membership;

    next();
  } catch (error) {
    next(error);
  }
};

export const requireWorkspaceAdmin = (
  req,
  res,
  next
) => {
  if (!req.membership) {
    return res.status(403).json({
      success: false,
      message: "Workspace membership required",
    });
  }

  if (!["owner", "admin"].includes(req.membership.role)) {
    return res.status(403).json({
      success: false,
      message: "Workspace admin permission required",
    });
  }

  next();
};