import mongoose from "mongoose";
import Channel from "../models/Channel.js";

export const getAccessibleChannel = async (channelId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    return null;
  }

  const channel = await Channel.findById(channelId);

  if (!channel) {
    return null;
  }

  const Workspace = (await import("../models/Workspace.js")).default;

  const workspace = await Workspace.findById(channel.workspace);

  if (!workspace) {
    return null;
  }

  const isWorkspaceMember = workspace.members.some(
    (member) => member.userId.toString() === userId.toString()
  );

  if (!isWorkspaceMember) {
    return null;
  }

  if (channel.type === "private") {
    const isChannelMember = channel.members.some(
      (memberId) => memberId.toString() === userId.toString()
    );

    if (!isChannelMember) {
      return null;
    }
  }

  return { channel, workspace };
};