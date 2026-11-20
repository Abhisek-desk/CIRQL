import Channel from "../models/Channel.js";

// CREATE CHANNEL
export const createChannel = async (req, res, next) => {
  try {
    const {
      name,
      description = "",
      type = "public",
    } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Channel name must contain at least 2 characters",
      });
    }

    if (!["public", "private"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid channel type",
      });
    }

    if (
      req.workspace.members.some(
        (member) =>
          member.userId.toString() === req.user._id.toString()
      ) === false
    ) {
      return res.status(403).json({
        success: false,
        message: "Workspace membership required",
      });
    }

    const channelData = {
      name: name.trim().toLowerCase().replace(/\s+/g, "-"),
      description,
      workspace: req.workspace._id,
      type,
      createdBy: req.user._id,
    };

    if (type === "private") {
      channelData.members = [req.user._id];
    }

    const channel = await Channel.create(channelData);

    return res.status(201).json({
      success: true,
      message: "Channel created successfully",
      channel,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A channel with this name already exists",
      });
    }

    next(error);
  }
};

// GET CHANNELS IN WORKSPACE
export const getWorkspaceChannels = async (
  req,
  res,
  next
) => {
  try {
    const channels = await Channel.find({
      workspace: req.workspace._id,
      $or: [
        { type: "public" },
        { members: req.user._id },
      ],
    })
      .populate("createdBy", "name email avatar")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      count: channels.length,
      channels,
    });
  } catch (error) {
    next(error);
  }
};

// GET SINGLE CHANNEL
export const getChannel = async (req, res, next) => {
  try {
    const channel = await Channel.findOne({
      _id: req.params.channelId,
      workspace: req.workspace._id,
    }).populate("createdBy", "name email avatar");

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    if (
      channel.type === "private" &&
      !channel.members.some(
        (memberId) =>
          memberId.toString() === req.user._id.toString()
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this private channel",
      });
    }

    return res.status(200).json({
      success: true,
      channel,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE CHANNEL
export const deleteChannel = async (req, res, next) => {
  try {
    const channel = await Channel.findOne({
      _id: req.params.channelId,
      workspace: req.workspace._id,
    });

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    const isCreator =
      channel.createdBy.toString() === req.user._id.toString();

    const isAdmin = ["owner", "admin"].includes(
      req.membership.role
    );

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You cannot delete this channel",
      });
    }

    await channel.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Channel deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};