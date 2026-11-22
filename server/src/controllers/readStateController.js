import mongoose from "mongoose";
import Channel from "../models/Channel.js";
import Workspace from "../models/Workspace.js";
import Message from "../models/Message.js";
import ChannelReadState from "../models/ChannelReadState.js";
import { getIO } from "../sockets/socket.js";

// GET UNREAD COUNTS FOR A WORKSPACE
export const getUnreadCounts = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;

    if (!mongoose.isValidObjectId(workspaceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    const isMember = workspace.members.some(
      (member) =>
        member.userId.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "Workspace access denied",
      });
    }

    const channels = await Channel.find({
      workspace: workspaceId,
      $or: [
        { type: "public" },
        { members: req.user._id },
      ],
    }).select("_id");

    const channelIds = channels.map((channel) => channel._id);

    const readStates = await ChannelReadState.find({
      user: req.user._id,
      channel: { $in: channelIds },
    });

    const readStateMap = new Map(
      readStates.map((state) => [
        state.channel.toString(),
        state.lastReadAt,
      ])
    );

    const unreadCounts = await Promise.all(
      channels.map(async (channel) => {
        const lastReadAt = readStateMap.get(
          channel._id.toString()
        );

        const filters = {
          channel: channel._id,
          deletedAt: null,
          sender: { $ne: req.user._id },
        };

        if (lastReadAt) {
          filters.createdAt = { $gt: lastReadAt };
        }

        const count = await Message.countDocuments(filters);

        return {
          channelId: channel._id,
          count,
        };
      })
    );

    return res.status(200).json({
      success: true,
      unreadCounts,
    });
  } catch (error) {
    next(error);
  }
};


// GET CHANNEL READ RECEIPTS
export const getChannelReadReceipts = async (req, res, next) => {
  try {
    const { channelId } = req.params;

    if (!mongoose.isValidObjectId(channelId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid channel ID",
      });
    }

    const channel = await Channel.findById(channelId);

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    const workspace = await Workspace.findById(channel.workspace);

    const isWorkspaceMember = workspace?.members.some(
      (member) =>
        member.userId.toString() === req.user._id.toString()
    );

    const isChannelMember =
      channel.type !== "private" ||
      channel.members.some(
        (memberId) =>
          memberId.toString() === req.user._id.toString()
      );

    if (!isWorkspaceMember || !isChannelMember) {
      return res.status(404).json({
        success: false,
        message: "Channel not found or access denied",
      });
    }

    const readStates = await ChannelReadState.find({
      channel: channel._id,
    })
      .populate("user", "name avatar")
      .sort({ lastReadAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      readStates: readStates
        .filter((state) => state.user)
        .map((state) => ({
          user: state.user,
          lastReadAt: state.lastReadAt,
        })),
    });
  } catch (error) {
    next(error);
  }
};

// MARK A CHANNEL AS READ
export const markChannelAsRead = async (req, res, next) => {
  try {
    const { channelId } = req.params;

    if (!mongoose.isValidObjectId(channelId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid channel ID",
      });
    }

    const channel = await Channel.findById(channelId);

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    const workspace = await Workspace.findById(channel.workspace);

    const isWorkspaceMember = workspace?.members.some(
      (member) =>
        member.userId.toString() === req.user._id.toString()
    );

    const isChannelMember =
      channel.type !== "private" ||
      channel.members.some(
        (memberId) =>
          memberId.toString() === req.user._id.toString()
      );

    if (!isWorkspaceMember || !isChannelMember) {
      return res.status(404).json({
        success: false,
        message: "Channel not found or access denied",
      });
    }

    const previousReadState = await ChannelReadState.findOne({
      user: req.user._id,
      channel: channel._id,
    }).lean();

    const unreadFilter = {
      channel: channel._id,
      deletedAt: null,
      sender: { $ne: req.user._id },
    };

    if (previousReadState?.lastReadAt) {
      unreadFilter.createdAt = {
        $gt: previousReadState.lastReadAt,
      };
    }

    const firstUnreadMessage = await Message.findOne(unreadFilter)
      .sort({ createdAt: 1, _id: 1 })
      .select("_id")
      .lean();

    const lastReadAt = new Date();

    await ChannelReadState.findOneAndUpdate(
      {
        user: req.user._id,
        channel: channel._id,
      },
      {
        $set: { lastReadAt },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    try {
      getIO().to(`channel:${channelId}`).emit("channel:read", {
        channelId: String(channelId),
        user: {
          _id: String(req.user._id),
          name: req.user.name,
          avatar: req.user.avatar || "",
        },
        lastReadAt,
      });
    } catch (socketError) {
      console.error("Could not broadcast read receipt:", socketError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Channel marked as read",
      channelId: channel._id,
      lastReadAt,
      firstUnreadMessageId: firstUnreadMessage?._id || null,
    });
  } catch (error) {
    next(error);
  }
};

