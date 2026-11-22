import Workspace from "../models/Workspace.js";
import User from "../models/User.js";

const createSlug = (name) => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${base}-${Date.now().toString(36)}`;
};

// CREATE WORKSPACE
export const createWorkspace = async (req, res, next) => {
  try {
    const { name, description = "" } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Workspace name must contain at least 2 characters",
      });
    }

    const workspace = await Workspace.create({
      name: name.trim(),
      slug: createSlug(name),
      description,
      owner: req.user._id,
      members: [
        {
          userId: req.user._id,
          role: "owner",
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Workspace created successfully",
      workspace,
    });
  } catch (error) {
    next(error);
  }
};

// GET MY WORKSPACES
export const getMyWorkspaces = async (req, res, next) => {
  try {
    const workspaces = await Workspace.find({
      "members.userId": req.user._id,
    })
      .populate("owner", "name email avatar")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: workspaces.length,
      workspaces,
    });
  } catch (error) {
    next(error);
  }
};

// GET SINGLE WORKSPACE
export const getWorkspace = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(
      req.params.workspaceId
    ).populate("owner", "name email avatar");

    return res.status(200).json({
      success: true,
      workspace,
    });
  } catch (error) {
    next(error);
  }
};

// UPDATE WORKSPACE
export const updateWorkspace = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Workspace name must contain at least 2 characters",
        });
      }

      req.workspace.name = name.trim();
    }

    if (description !== undefined) {
      req.workspace.description = description;
    }

    await req.workspace.save();

    return res.status(200).json({
      success: true,
      message: "Workspace updated successfully",
      workspace: req.workspace,
    });
  } catch (error) {
    next(error);
  }
};

// ADD WORKSPACE MEMBER
export const addWorkspaceMember = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const alreadyMember = req.workspace.members.some(
      (member) =>
        member.userId.toString() === user._id.toString()
    );

    if (alreadyMember) {
      return res.status(409).json({
        success: false,
        message: "User is already a workspace member",
      });
    }

    req.workspace.members.push({
      userId: user._id,
      role: "member",
    });

    await req.workspace.save();

    return res.status(201).json({
      success: true,
      message: "Member added successfully",
      member: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: "member",
      },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE WORKSPACE
export const deleteWorkspace = async (req, res, next) => {
  try {
    await req.workspace.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Workspace deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// GET WORKSPACE MEMBERS (FOR @MENTIONS)
export const getWorkspaceMembers = async (req, res, next) => {
  try {
    const workspace = await Workspace.findById(req.params.workspaceId)
      .populate("members.userId", "name avatar");

    const members = workspace.members
      .filter((member) => member.userId)
      .map((member) => ({
        _id: member.userId._id,
        name: member.userId.name,
        avatar: member.userId.avatar,
        role: member.role,
      }));

    return res.status(200).json({
      success: true,
      members,
    });
  } catch (error) {
    next(error);
  }
};