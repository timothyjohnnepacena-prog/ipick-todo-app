"use client";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  DndContext, closestCorners, PointerSensor, useSensor, useSensors,
  useDroppable, DragOverlay, defaultDropAnimationSideEffects
} from "@dnd-kit/core";
import { 
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function TaskCard({ task, fetchData, isOverlay, isDragging, session }) {
  return (
    <div 
      onDoubleClick={async () => {
        const newText = prompt("Edit Task:", task.text);
        if (newText && newText !== task.text) {
          await fetch("/api/todos", { 
            method: "PATCH", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ type: "edit_task", taskId: task._id, newText }) 
          });
          if(fetchData) fetchData();
        }
      }}
      className={`bg-white p-4 rounded-xl border shadow-sm touch-none transition-all group ${
      isOverlay ? 'border-[#F37A22] shadow-2xl scale-105 rotate-2 cursor-grabbing' : 'border-slate-100 cursor-grab'
    } ${isDragging ? 'opacity-30' : 'opacity-100'}`}
    >
      <p className="font-semibold text-slate-700 text-xs mb-3 leading-snug cursor-text" title="Double click to edit">{task.text}</p>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
        <span className="text-[10px] font-bold text-[#F37A22] bg-[#F37A22]/10 px-2 py-0.5 rounded-md uppercase">
          {task.displayName}
        </span>
        <button 
          onPointerDown={(e) => e.stopPropagation()}
          onClick={async () => { 
            if (confirm("Delete?")) { 
              await fetch("/api/todos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: task._id }) }); 
              if(fetchData) fetchData(); 
            } 
          }}
          className="text-[10px] font-bold text-slate-300 hover:text-[#9E2A2B] uppercase transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function SortableTask({ task, fetchData, session }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: task._id, data: { type: "Task", task }
  });
  const style = { transform: CSS.Translate.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} fetchData={fetchData} isDragging={isDragging} session={session} />
    </div>
  );
}

function KanbanColumn({ list, tasks, fetchData, session }) {
  const { setNodeRef } = useDroppable({ id: list._id, data: { type: "List", list } });
  const [menuOpen, setMenuOpen] = useState(false);
  const listTasks = tasks.filter(t => t.listId === list._id);

  const handleAddTask = async () => {
    const text = prompt("New Task:");
    if (text) {
      await fetch("/api/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "task", data: { text, listId: list._id } }) });
      fetchData();
    }
  };

  const handleRenameList = async () => {
    setMenuOpen(false);
    const newName = prompt("Rename list:", list.name);
    if (newName && newName !== list.name) {
      await fetch("/api/todos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "list", listId: list._id, newName }) });
      fetchData();
    }
  };

  const handleDeleteList = async () => {
    setMenuOpen(false);
    if (confirm(`Delete the "${list.name}" list and ALL tasks inside it?`)) {
      await fetch("/api/todos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "list", listId: list._id }) });
      fetchData();
    }
  };

  return (
    <div ref={setNodeRef} className="bg-slate-100/80 backdrop-blur-md min-w-[280px] w-[280px] p-4 rounded-2xl border border-slate-200/60 flex flex-col relative shadow-sm hover:shadow-md transition-shadow shrink-0">
      <div className="flex justify-between items-center mb-4 px-1 relative z-50">
        <h2 className="font-bold text-slate-600 uppercase text-[11px] tracking-wider truncate mr-2">{list.name}</h2>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="h-5 min-w-[20px] px-1.5 flex items-center justify-center text-[10px] font-bold bg-[#12A55C]/10 text-[#12A55C] rounded-md shadow-sm">
            {listTasks.length}
          </span>
          <button onClick={handleAddTask} className="h-5 w-5 flex items-center justify-center bg-white text-[#12A55C] rounded-md shadow-sm hover:bg-[#12A55C] hover:text-white transition-colors text-[14px] font-bold" title="Add Task">+</button>
          
          <div className="relative h-5">
            <button onClick={() => setMenuOpen(!menuOpen)} className="h-5 w-5 flex items-center justify-center bg-white text-slate-400 rounded-md shadow-sm hover:bg-slate-200 transition-colors text-[10px] font-black tracking-widest pb-1">...</button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden text-xs font-bold">
                  <button onClick={handleRenameList} className="w-full text-left px-4 py-3 text-slate-600 hover:bg-slate-50 border-b border-slate-50 transition-colors">Rename List</button>
                  <button onClick={handleDeleteList} className="w-full text-left px-4 py-3 text-[#9E2A2B] hover:bg-[#9E2A2B]/10 transition-colors">Delete List</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      <SortableContext id={list._id} items={listTasks.map(t => t._id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3 flex-1 min-h-[150px] relative z-10">
          {listTasks.map(task => <SortableTask key={task._id} task={task} fetchData={fetchData} session={session} />)}
        </div>
      </SortableContext>

      <button onClick={handleAddTask} className="w-full mt-4 py-2.5 bg-white text-[#12A55C] rounded-xl text-[10px] font-bold uppercase hover:bg-[#12A55C] hover:text-white transition-all shadow-sm border border-slate-200 relative z-10">
        + Add Task
      </button>
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); 
  const [activeTab, setActiveTab] = useState("board"); 
  
  const [lists, setLists] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]); 
  const [activeUsers, setActiveUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [activeTask, setActiveTask] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session) fetchData();
  }, [session, selectedUsers]);

  const fetchData = async () => {
    try {
      const userQuery = selectedUsers.length ? `?users=${selectedUsers.join(",")}` : "";
      const res = await fetch(`/api/todos${userQuery}`);
      const data = await res.json();
      
      setLists(data.lists || []);
      setTasks(data.tasks || []);
      setLogs(data.logs || []); 
      
      if (data.users) {
        setActiveUsers(data.users.map(u => ({
          id: u._id,
          name: u.nickname || u.name || "User"
        })));
      }
    } finally { setFetching(false); }
  };

  const handleClearLogs = async () => {
    if (confirm("Permanently delete all activity logs?")) {
      await fetch("/api/todos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "all_logs" }) });
      fetchData();
    }
  };

  const onDragStart = (event) => { setActiveTask(tasks.find(t => t._id === event.active.id)); };

  const onDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === "Task";
    const isOverTask = over.data.current?.type === "Task";
    const isOverList = over.data.current?.type === "List";

    if (!isActiveTask) return;

    setTasks(prev => {
      const activeIndex = prev.findIndex(t => t._id === activeId);
      const overIndex = prev.findIndex(t => t._id === overId);

      if (isOverTask && prev[activeIndex].listId !== prev[overIndex].listId) {
        const newTasks = [...prev];
        newTasks[activeIndex].listId = newTasks[overIndex].listId;
        return arrayMove(newTasks, activeIndex, overIndex);
      }
      if (isOverList && prev[activeIndex].listId !== overId) {
        const newTasks = [...prev];
        newTasks[activeIndex].listId = overId;
        return arrayMove(newTasks, activeIndex, newTasks.length - 1);
      }
      return prev;
    });
  };

  const onDragEnd = async (event) => {
    const draggedTask = tasks.find(t => t._id === event.active.id);
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeIndex = tasks.findIndex(t => t._id === active.id);
    const overIndex = tasks.findIndex(t => t._id === over.id);

    let updatedTasks = [...tasks];
    if (activeIndex !== overIndex) {
      updatedTasks = arrayMove(updatedTasks, activeIndex, overIndex);
      setTasks(updatedTasks);
    }

    const listIdToUpdate = updatedTasks[activeIndex].listId;
    const tasksInList = updatedTasks.filter(t => t.listId === listIdToUpdate);

    const isNewList = draggedTask.listId !== listIdToUpdate;
    const newListName = lists.find(l => l._id === listIdToUpdate)?.name || "a list";
    const logMessage = isNewList 
        ? `Moved "${draggedTask.text}" into "${newListName}"`
        : `Reordered tasks in "${newListName}"`;

    await fetch("/api/todos", { 
      method: "PATCH", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ bulk: true, tasks: tasksInList, logMessage }) 
    });
    
    fetchData(); 
  };

  if (status === "loading" || (status === "authenticated" && fetching)) {
    return <div className="min-h-screen bg-[#F1F3F6] flex items-center justify-center font-black text-[#12A55C] animate-pulse text-sm tracking-widest">LOADING IPICK BOARD...</div>;
  }

  if (session) {
    const nickname = session?.user?.name?.split(' ')[0] || session?.user?.email?.split('@')[0] || "User";

    return (
      <div className="flex flex-col md:flex-row h-screen bg-[#F1F3F6] overflow-hidden text-slate-800">
        <div className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center z-40 shrink-0">
          <img src="/ipick-logo-navbar.png" alt="iPick Center" className="h-8 object-contain" />
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600 hover:text-[#12A55C] focus:outline-none">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-slate-800/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
        )}

        <aside className={`fixed inset-y-0 left-0 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out z-50 md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} ${isSidebarCollapsed ? 'md:w-20' : 'w-64'} shrink-0 shadow-xl md:shadow-sm`}>
          <div className={`p-5 hidden md:flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} border-b border-slate-100`}>
            {!isSidebarCollapsed && (
              <img src="/ipick-logo-navbar.png" alt="iPick Center" className="h-8 object-contain" />
            )}
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="text-slate-400 hover:text-[#12A55C] transition-colors p-1 rounded-md hover:bg-slate-50">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </button>
          </div>

          <nav className="flex-1 mt-6 px-3 space-y-2">
            <button onClick={() => { setActiveTab("board"); setIsMobileMenuOpen(false); }} className={`w-full flex items-center p-3 rounded-xl transition-all font-bold text-sm ${activeTab === "board" ? "bg-[#12A55C] text-white shadow-md shadow-[#12A55C]/20" : "text-slate-500 hover:bg-slate-50 hover:text-[#12A55C]"} ${isSidebarCollapsed ? 'md:justify-center' : 'justify-start'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z" /></svg>
              <span className={`ml-3 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>To Do Board</span>
            </button>
            <button onClick={() => { setActiveTab("logs"); setIsMobileMenuOpen(false); }} className={`w-full flex items-center p-3 rounded-xl transition-all font-bold text-sm ${activeTab === "logs" ? "bg-[#12A55C] text-white shadow-md shadow-[#12A55C]/20" : "text-slate-500 hover:bg-slate-50 hover:text-[#12A55C]"} ${isSidebarCollapsed ? 'md:justify-center' : 'justify-start'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
              <span className={`ml-3 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>Activity Logs</span>
            </button>
          </nav>

          <div className="p-4 border-t border-slate-100 flex flex-col gap-2">
            <div className={`px-2 mb-1 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Logged in as</p>
              <p className="text-sm font-bold text-slate-700 truncate">{nickname}</p>
            </div>
            <button onClick={() => signOut()} className={`w-full flex items-center p-3 rounded-xl transition-colors font-bold text-sm text-[#9E2A2B] hover:bg-[#9E2A2B]/10 ${isSidebarCollapsed ? 'md:justify-center' : 'justify-start'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" /></svg>
              <span className={`ml-3 ${isSidebarCollapsed ? 'md:hidden' : 'block'}`}>Log Out</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col h-full overflow-hidden p-3 md:p-6 relative">
          {activeTab === "board" && (
            <div className="relative bg-white rounded-3xl p-4 md:p-8 border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="absolute inset-0 bg-[url('/ipick-logo-navbar.png')] bg-center bg-no-repeat bg-[length:70%] md:bg-[length:35%] opacity-[0.12] mix-blend-multiply pointer-events-none z-0"></div>

              <div className="relative z-20 w-full bg-slate-50/90 backdrop-blur-sm border border-slate-200 rounded-2xl p-3 md:p-4 mb-4 md:mb-6 flex flex-wrap gap-2 md:gap-4 items-center shrink-0">
                <span className="text-[10px] md:text-xs font-black uppercase text-slate-400 px-1">Filter Board:</span>
                <button onClick={() => setSelectedUsers([])} className={`px-4 md:px-5 py-1.5 md:py-2 rounded-xl text-[10px] md:text-[11px] font-bold border transition-colors ${selectedUsers.length === 0 ? 'bg-[#12A55C] text-white border-[#12A55C]' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100'}`}>ALL</button>
                {activeUsers.map(user => (
                  <button 
                    key={user.id} 
                    onClick={() => setSelectedUsers(prev => prev.includes(user.id) ? prev.filter(e => e !== user.id) : [...prev, user.id])} 
                    className={`px-4 md:px-5 py-1.5 md:py-2 rounded-xl text-[10px] md:text-[11px] font-bold border transition-colors ${selectedUsers.includes(user.id) ? 'bg-[#F37A22] text-white border-[#F37A22] shadow-md shadow-[#F37A22]/20' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-100 hover:border-[#F37A22]/40'}`}
                  >
                    {user.name.toUpperCase()}
                  </button>
                ))}
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
                <div className="relative z-10 flex gap-4 md:gap-6 items-start overflow-x-auto overflow-y-hidden pb-4 flex-1 h-full">
                  {lists.map(list => <KanbanColumn key={list._id} list={list} tasks={tasks} fetchData={fetchData} session={session} />)}
                  
                  <button onClick={async () => { const name = prompt("List Name:"); if (name) { await fetch("/api/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "list", data: { name } }) }); fetchData(); } }} className="min-w-[280px] border-2 border-dashed border-slate-300 rounded-2xl p-6 text-slate-400 font-bold hover:bg-slate-50 hover:border-[#F37A22] hover:text-[#F37A22] transition-all text-xs uppercase tracking-widest relative z-10 bg-white/60 backdrop-blur-sm shrink-0">
                    + New Column
                  </button>
                </div>
                <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }) }}>
                  {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
                </DragOverlay>
              </DndContext>
            </div>
          )}

          {activeTab === "logs" && (
            <div className="relative bg-white rounded-3xl p-4 md:p-8 border border-slate-200 shadow-sm overflow-auto flex-1 flex flex-col h-full">
               <div className="border-b border-slate-100 pb-4 mb-6 flex justify-between items-start md:items-center gap-4">
                 <div>
                   <h2 className="text-xl md:text-2xl font-black text-[#12A55C] tracking-tight">Activity Logs</h2>
                   <p className="text-slate-400 text-xs md:text-sm mt-1">Track the history of board updates and tasks.</p>
                 </div>
                 
                 <button onClick={handleClearLogs} className="bg-[#9E2A2B]/10 text-[#9E2A2B] px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-[10px] md:text-[11px] font-bold hover:bg-[#9E2A2B]/20 transition-colors uppercase tracking-wider shrink-0 border border-[#9E2A2B]/20">
                   Delete All
                 </button>
               </div>
               
               {logs.length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center text-center p-6 md:p-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                   <h3 className="font-bold text-slate-500 mb-1">No Activity Logged Yet</h3>
                   <p className="text-xs md:text-sm text-slate-400 max-w-sm">When users add, move, or delete tasks, the history will appear here.</p>
                 </div>
               ) : (
                 <div className="space-y-3 md:space-y-4 max-w-4xl">
                   {logs.map((log) => {
                     const isDelete = log.action.includes("DELETE");
                     const isAdd = log.action.includes("ADD");
                     const isEdit = log.action.includes("EDIT");
                     
                     return (
                       <div key={log._id} className="flex items-start gap-3 md:gap-4 p-3 md:p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-sm transition-all">
                         <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isDelete ? 'bg-[#9E2A2B]/10 text-[#9E2A2B]' : isAdd ? 'bg-[#12A55C]/10 text-[#12A55C]' : isEdit ? 'bg-blue-100 text-blue-500' : 'bg-[#F37A22]/10 text-[#F37A22]'}`}>
                            {isDelete ? "X" : isAdd ? "+" : isEdit ? "E" : "R"}
                         </div>
                         <div>
                           <p className="text-xs md:text-sm text-slate-700">
                             <span className="font-bold text-[#F37A22] bg-white px-1.5 py-0.5 rounded-md border border-slate-100 shadow-sm mr-1">{log.displayName}</span> 
                             {log.details}
                           </p>
                           <p className="text-[10px] md:text-xs text-slate-400 mt-1.5 font-medium">
                             {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(log.createdAt))}
                           </p>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               )}
            </div>
          )}
        </main>
      </div>
    );
  }
  return null;
}