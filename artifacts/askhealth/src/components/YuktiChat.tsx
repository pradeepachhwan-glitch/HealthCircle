import { useState, useRef, useEffect } from "react";
import { useYuktiChat } from "@workspace/api-client-react";
import { ChatMessage, ChatMessageRole } from "@workspace/api-client-react/src/generated/api.schemas";
import { Send, Bot, User as UserIcon, X, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function YuktiChat({ communityId, communityName }: { communityId?: number, communityName?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: `Hello! I'm Yukti AI. How can I help you with ${communityName ? communityName : "your clinical questions"} today?` }
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = useYuktiChat();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMsg: ChatMessage = { role: "user", content: input };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");

    chatMutation.mutate({
      data: {
        message: userMsg.content,
        communityId,
        communityName,
        history: messages
      }
    }, {
      onSuccess: (data) => {
        setMessages([...newHistory, { role: "assistant", content: data.reply }]);
      },
      onError: () => {
        setMessages([...newHistory, { role: "assistant", content: "I'm sorry, I encountered an error. Please try again." }]);
      }
    });
  };

  if (!isOpen) {
    return (
      <Button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 rounded-full w-14 h-14 shadow-lg bg-sidebar-primary hover:bg-sidebar-primary/90 text-white z-50 flex items-center justify-center p-0"
      >
        <Bot className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Card className={cn(
      "fixed z-50 flex flex-col shadow-2xl transition-all duration-200 ease-in-out border-border overflow-hidden",
      isExpanded 
        ? "inset-4 md:inset-10 lg:inset-y-10 lg:inset-x-auto lg:right-10 lg:w-[800px]" 
        : "bottom-20 right-4 md:bottom-6 md:right-6 w-[calc(100vw-32px)] md:w-[380px] h-[500px]"
    )}>
      <CardHeader className="bg-sidebar text-sidebar-foreground px-4 py-3 flex flex-row items-center justify-between border-b border-sidebar-border space-y-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Yukti AI</CardTitle>
            {communityName && <p className="text-xs text-sidebar-foreground/70 line-clamp-1">{communityName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setIsOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 flex flex-col overflow-hidden bg-background">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3 max-w-[85%]", msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto")}>
                <div className={cn(
                  "w-8 h-8 rounded-full flex shrink-0 items-center justify-center",
                  msg.role === "user" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
                )}>
                  {msg.role === "user" ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={cn(
                  "px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap",
                  msg.role === "user" 
                    ? "bg-secondary text-secondary-foreground rounded-tr-sm" 
                    : "bg-muted text-foreground rounded-tl-sm"
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex gap-3 max-w-[85%] mr-auto">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex shrink-0 items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="px-4 py-3 rounded-2xl bg-muted rounded-tl-sm flex items-center gap-1">
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="p-3 border-t bg-card">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center gap-2"
          >
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Yukti AI..."
              className="flex-1 bg-background"
              disabled={chatMutation.isPending}
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={!input.trim() || chatMutation.isPending}
              className="shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
