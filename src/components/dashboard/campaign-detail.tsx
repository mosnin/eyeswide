"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Topbar } from "@/components/layout/topbar";
import type { AccountType } from "@/types/database";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Loader2,
  Calendar,
  Package,
  FileText,
  MessageSquare,
} from "lucide-react";

interface CampaignDetailProps {
  campaign: Record<string, unknown>;
  messages: Record<string, unknown>[];
  userId: string;
  accountType: string;
}

function getStatusColor(status: string) {
  switch (status) {
    case "pending":
      return "bg-yellow-500/10 text-yellow-600";
    case "accepted":
    case "in_progress":
      return "bg-blue-500/10 text-blue-600";
    case "completed":
      return "bg-green-500/10 text-green-600";
    case "rejected":
    case "cancelled":
      return "bg-red-500/10 text-red-600";
    default:
      return "bg-gray-500/10 text-gray-600";
  }
}

export function CampaignDetail({
  campaign,
  messages,
  userId,
  accountType,
}: CampaignDetailProps) {
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const router = useRouter();

  const brand = campaign.brand_profiles as Record<string, unknown>;
  const creator = campaign.creator_profiles as Record<string, unknown>;
  const deliverables: string[] = (campaign.deliverables as string[]) || [];
  const campaignDeadline = campaign.deadline as string | null;
  const compensationDetails = campaign.compensation_details as string | null;

  async function updateStatus(newStatus: string) {
    setUpdatingStatus(true);
    const supabase = createClient();

    await supabase
      .from("campaigns")
      .update({ status: newStatus })
      .eq("id", campaign.id);

    router.refresh();
    setUpdatingStatus(false);
  }

  async function sendMessage() {
    if (!newMessage.trim()) return;
    setSendingMessage(true);

    const supabase = createClient();
    await supabase.from("messages").insert({
      campaign_id: campaign.id as string,
      sender_id: userId,
      content: newMessage.trim(),
    });

    setNewMessage("");
    setSendingMessage(false);
    router.refresh();
  }

  return (
    <div>
      <Topbar
        accountType={accountType as AccountType}
        userName=""
        title={campaign.title as string}
      />

      <div className="mx-auto max-w-3xl p-6 space-y-6">
        {/* Status & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant="secondary"
            className={`text-sm ${getStatusColor(campaign.status as string)}`}
          >
            {campaign.status as string}
          </Badge>

          {/* Creator actions */}
          {accountType === "creator" && campaign.status === "pending" && (
            <>
              <Button
                size="sm"
                onClick={() => updateStatus("accepted")}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStatus("rejected")}
                disabled={updatingStatus}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Decline
              </Button>
            </>
          )}

          {/* Brand actions */}
          {accountType === "brand" && campaign.status === "accepted" && (
            <Button
              size="sm"
              onClick={() => updateStatus("in_progress")}
              disabled={updatingStatus}
            >
              <Clock className="mr-2 h-4 w-4" />
              Mark In Progress
            </Button>
          )}

          {campaign.status === "in_progress" && (
            <Button
              size="sm"
              onClick={() => updateStatus("completed")}
              disabled={updatingStatus}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark Complete
            </Button>
          )}

          {accountType === "brand" &&
            !["completed", "cancelled", "rejected"].includes(
              campaign.status as string
            ) && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => updateStatus("cancelled")}
                disabled={updatingStatus}
              >
                Cancel Campaign
              </Button>
            )}
        </div>

        {/* Campaign Details */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Description</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">
                  {campaign.description as string}
                </p>
              </CardContent>
            </Card>

            {/* Requirements */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">
                    Requirements & Terms
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">
                  {campaign.requirements as string}
                </p>
              </CardContent>
            </Card>

            {/* Messages */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Messages</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No messages yet. Start the conversation.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {messages.map((msg) => {
                      const isOwn = msg.sender_id === userId;
                      const sender = msg.profiles as Record<string, unknown>;
                      return (
                        <div
                          key={msg.id as string}
                          className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                              isOwn
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <p className="text-xs font-medium mb-1">
                              {(sender?.full_name as string) || "User"}
                            </p>
                            <p className="text-sm">{msg.content as string}</p>
                            <p
                              className={`text-xs mt-1 ${
                                isOwn
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {new Date(
                                msg.created_at as string
                              ).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Separator />

                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    onClick={sendMessage}
                    disabled={sendingMessage || !newMessage.trim()}
                    className="shrink-0"
                  >
                    {sendingMessage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Participants */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Participants
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Brand</p>
                  <p className="font-medium">
                    {brand?.company_name as string}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Creator</p>
                  <p className="font-medium">
                    {creator?.display_name as string}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Deliverables */}
            {deliverables.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Deliverables
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {deliverables.map((d, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-sm"
                      >
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Compensation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Compensation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="capitalize">
                  {(campaign.compensation_type as string).replace(/_/g, " ")}
                </Badge>
                {compensationDetails && (
                  <p className="mt-2 text-sm">
                    {compensationDetails}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Deadline */}
            {campaignDeadline && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Deadline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    {new Date(campaignDeadline).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
