import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { AnimatePresence, motion } from "motion/react";
import toast from "react-hot-toast";

import WorkspaceSidebar from "../components/common/WorkspaceSidebar";
import ChannelSidebar from "../components/channels/ChannelSidebar";
import ChatHeader from "../components/chat/ChatHeader";
import ChatMessages from "../components/chat/ChatMessages";
import MessageComposer from "../components/chat/MessageComposer";
import CreateItemModal from "../components/common/CreateItemModal";

import workspaceService from "../features/workspace/workspaceService";

export default function MainLayout() {
  const user = useSelector((state) => state.auth.user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);

  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [channelModalOpen, setChannelModalOpen] = useState(false);

  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    try {
      setLoadingWorkspaces(true);

      const data = await workspaceService.getWorkspaces();
      setWorkspaces(data);

      setSelectedWorkspace((current) => {
        if (current && data.some((item) => item._id === current._id)) {
          return data.find((item) => item._id === current._id);
        }

        return data[0] || null;
      });
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not load workspaces"
      );
    } finally {
      setLoadingWorkspaces(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  useEffect(() => {
    let active = true;

    const loadChannels = async () => {
      if (!selectedWorkspace?._id) {
        setChannels([]);
        setSelectedChannel(null);
        return;
      }

      try {
        setLoadingChannels(true);
        setChannels([]);
        setSelectedChannel(null);

        const data = await workspaceService.getChannels(
          selectedWorkspace._id
        );

        if (!active) return;

        setChannels(data);
        setSelectedChannel(data[0] || null);
      } catch (error) {
        if (active) {
          toast.error(
            error.response?.data?.message || "Could not load channels"
          );
        }
      } finally {
        if (active) setLoadingChannels(false);
      }
    };

    loadChannels();

    return () => {
      active = false;
    };
  }, [selectedWorkspace?._id]);

  const handleCreateWorkspace = async (data) => {
    try {
      const workspace = await workspaceService.createWorkspace(data);

      setWorkspaces((previous) => [workspace, ...previous]);
      setSelectedWorkspace(workspace);
      setWorkspaceModalOpen(false);

      toast.success("Workspace created successfully");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not create workspace"
      );
      throw error;
    }
  };

  const handleCreateChannel = async (data) => {
    if (!selectedWorkspace) return;

    try {
      const channel = await workspaceService.createChannel(
        selectedWorkspace._id,
        data
      );

      setChannels((previous) => [...previous, channel]);
      setSelectedChannel(channel);

      toast.success("Channel created successfully");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not create channel"
      );
      throw error;
    }
  };

  const handleSelectWorkspace = (workspace) => {
    setSelectedWorkspace(workspace);
    setMobileMenuOpen(false);
  };

  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <div className="hidden lg:flex">
        <WorkspaceSidebar
          workspaces={workspaces}
          selectedWorkspace={selectedWorkspace}
          onSelectWorkspace={handleSelectWorkspace}
          onCreateWorkspace={() => setWorkspaceModalOpen(true)}
        />
      </div>

      <div className="hidden lg:flex">
        <ChannelSidebar
          workspace={selectedWorkspace}
          channels={channels}
          selectedChannel={selectedChannel}
          onSelectChannel={handleSelectChannel}
          onCreateChannel={() => setChannelModalOpen(true)}
          user={user}
        />
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 25 }}
              className="flex h-full"
              onClick={(event) => event.stopPropagation()}
            >
              <WorkspaceSidebar
                workspaces={workspaces}
                selectedWorkspace={selectedWorkspace}
                onSelectWorkspace={handleSelectWorkspace}
                onCreateWorkspace={() => setWorkspaceModalOpen(true)}
              />
              <ChannelSidebar
                onClose={() => setMobileMenuOpen(false)}
                workspace={selectedWorkspace}
                channels={channels}
                selectedChannel={selectedChannel}
                onSelectChannel={handleSelectChannel}
                onCreateChannel={() => setChannelModalOpen(true)}
                user={user}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          onMenuClick={() => setMobileMenuOpen(true)}
          channel={selectedChannel}
        />

        {loadingWorkspaces || loadingChannels ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
          </div>
        ) : !selectedWorkspace ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 text-3xl font-black text-indigo-500">
              C
            </div>
            <h2 className="text-2xl font-bold text-[var(--text)]">
              Your team starts here
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
              Create your first workspace and bring your team conversations together.
            </p>
            <button
              onClick={() => setWorkspaceModalOpen(true)}
              className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Create workspace
            </button>
          </div>
        ) : !selectedChannel ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
              #
            </div>
            <h2 className="text-xl font-bold text-[var(--text)]">
              No channels yet
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Create a channel to start your first conversation.
            </p>
            <button
              onClick={() => setChannelModalOpen(true)}
              className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Create channel
            </button>
          </div>
        ) : (
          <>
            <ChatMessages messages={[]} typing={false} />
            <MessageComposer
              onSend={() => {
                toast("Real-time messaging integration is the next step.");
              }}
            />
          </>
        )}
      </main>

      <CreateItemModal
        open={workspaceModalOpen}
        onClose={() => setWorkspaceModalOpen(false)}
        onSubmit={handleCreateWorkspace}
        title="Create a workspace"
        description="Give your team a dedicated place to collaborate."
      />

      <CreateItemModal
        open={channelModalOpen}
        onClose={() => setChannelModalOpen(false)}
        onSubmit={handleCreateChannel}
        title="Create a channel"
        description={`Add a conversation space to ${selectedWorkspace?.name || "your workspace"}.`}
        isChannel
      />
    </div>
  );
}
