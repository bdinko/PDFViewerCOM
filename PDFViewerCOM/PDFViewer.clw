!!! <summary>
!!! Generated from procedure template - Window
!!! </summary>
ShowPdfViewer PROCEDURE 

udpt            UltimateDebugProcedureTracker
PdfName              STRING(255)                           ! 
Window               WINDOW('Caption'),AT(,,395,224),FONT('Segoe UI',9),RESIZE,GRAY,MDI,SYSTEM
                       BUTTON('&OK'),AT(287,201,47,14),USE(?OkButton),LEFT,ICON('WAOk.ico'),DEFAULT
                       BUTTON('&Cancel'),AT(340,201,47,14),USE(?CancelButton),LEFT,ICON('WACancel.ico'),STD(STD:Close)
                       PROMPT('Pdf Name:'),AT(30,13),USE(?PdfName:Prompt)
                       ENTRY(@s255),AT(80,12,273,10),USE(PdfName),LEFT
                       BUTTON('...'),AT(357,11,12,12),USE(?LookupFile)
                       OLE,AT(9,26,378,172),USE(?UltimateCOM)
                       END
                     END

                 MAP
UCProcessCOMEvents_PDFViewerCOM PROCEDURE()
                 END
                 
PDFViewerCOM  UltimateCOM
PDFViewerCOM_Ctrl  LONG
PDFViewerCOM_Event EQUATE(Event:User + 2000 + ?UltimateCOM)                

ThisWindow           CLASS(WindowManager)
Init                   PROCEDURE(),BYTE,PROC,DERIVED
Kill                   PROCEDURE(),BYTE,PROC,DERIVED
TakeAccepted           PROCEDURE(),BYTE,PROC,DERIVED
TakeEvent              PROCEDURE(),BYTE,PROC,DERIVED
TakeWindowEvent        PROCEDURE(),BYTE,PROC,DERIVED
                     END

Toolbar              ToolbarClass
! ----- csResize --------------------------------------------------------------------------
csResize             Class(csResizeClass)
    ! derived method declarations
Fetch                  PROCEDURE (STRING Sect,STRING Ent,*? Val),VIRTUAL
Update                 PROCEDURE (STRING Sect,STRING Ent,STRING Val),VIRTUAL
Init                   PROCEDURE (),VIRTUAL
                     End  ! csResize
! ----- end csResize -----------------------------------------------------------------------
FileLookup1          SelectFileClass

  CODE
  GlobalResponse = ThisWindow.Run()                        ! Opens the window and starts an Accept Loop

!---------------------------------------------------------------------------
DefineListboxStyle ROUTINE
!|
!| This routine create all the styles to be shared in this window
!| It`s called after the window open
!|
!---------------------------------------------------------------------------

ThisWindow.Init PROCEDURE

ReturnValue          BYTE,AUTO

  CODE
        udpt.Init(UD,'ShowPdfViewer','SCHOOL003.clw','SCHOOL.EXE','03/21/2026 @ 12:36AM')    
             
  GlobalErrors.SetProcedureName('ShowPdfViewer')
  SELF.Request = GlobalRequest                             ! Store the incoming request
  ReturnValue = PARENT.Init()
  IF ReturnValue THEN RETURN ReturnValue.
  SELF.FirstField = ?OkButton
  SELF.VCRRequest &= VCRRequest
  SELF.Errors &= GlobalErrors                              ! Set this windows ErrorManager to the global ErrorManager
  SELF.AddItem(Toolbar)
  CLEAR(GlobalRequest)                                     ! Clear GlobalRequest after storing locally
  CLEAR(GlobalResponse)
  SELF.Open(Window)                                        ! Open window
  Do DefineListboxStyle
  Window{Prop:Alrt,255} = CtrlShiftP
  csResize.Init('ShowPdfViewer',Window,1)
  FileLookup1.Init
  FileLookup1.ClearOnCancel = True
  FileLookup1.Flags=BOR(FileLookup1.Flags,FILE:LongName)   ! Allow long filenames
  FileLookup1.SetMask('All Files','*.*')                   ! Set the file mask
  FileLookup1.AddMask('PDF','*.PDF')                       ! Add additional masks
  csResize.Open()
  SELF.SetAlerts()
  !  ?LookupFile{PROP:Disable} = TRUE
  !  ?PdfName   {PROP:Disable} = TRUE
  RETURN ReturnValue


ThisWindow.Kill PROCEDURE

ReturnValue          BYTE,AUTO

  CODE
  ReturnValue = PARENT.Kill()
  IF ReturnValue THEN RETURN ReturnValue.
  GlobalErrors.SetProcedureName
            
   
  RETURN ReturnValue


ThisWindow.TakeAccepted PROCEDURE

ReturnValue          BYTE,AUTO

Looped BYTE
  CODE
  LOOP                                                     ! This method receive all EVENT:Accepted's
    IF Looped
      RETURN Level:Notify
    ELSE
      Looped = 1
    END
  ReturnValue = PARENT.TakeAccepted()
    CASE ACCEPTED()
    OF ?LookupFile
      ThisWindow.Update()
      PdfName = FileLookup1.Ask(1)
      DISPLAY            
      PDFViewerCOM{'About'}
      ud.Debug ('*** PdfName=' & clip(PdfName))
      !PDFViewerCOM{'LoadFile(' & clip(PdfName) & ')'}   
      PDFViewerCOM{'FilePath'} = clip(PdfName)
      ud.debug ('  --- LoadFilePath=' & clip (PDFViewerCOM{'LoadFilePath()'} ))
      ud.Debug ('GetLastError=' & clip(PDFViewerCOM{'GetLastError()'})) 
      ud.debug('prošlo je sve')
      Display            
      
    END
    RETURN ReturnValue
  END
  ReturnValue = Level:Fatal
  RETURN ReturnValue


ThisWindow.TakeEvent PROCEDURE

ReturnValue          BYTE,AUTO

Looped BYTE
  CODE
  csResize.TakeEvent()
  LOOP                                                     ! This method receives all events
    IF Looped
      RETURN Level:Notify
    ELSE
      Looped = 1
    END
  ReturnValue = PARENT.TakeEvent()
  IF Event() = PDFViewerCOM_Event       
     UCProcessCOMEvents_PDFViewerCOM()
  END
  
     IF KEYCODE()=CtrlShiftP AND EVENT() = Event:PreAlertKey
       CYCLE
     END
     IF KEYCODE()=CtrlShiftP  
        UD.ShowProcedureInfo('ShowPdfViewer',UD.SetApplicationName('SCHOOL','EXE'),Window{PROP:Hlp},'02/27/2026 @ 10:24PM','03/21/2026 @ 12:36AM','03/21/2026 @ 12:36AM')  
    
       CYCLE
     END
    RETURN ReturnValue
  END
  ReturnValue = Level:Fatal
  RETURN ReturnValue


ThisWindow.TakeWindowEvent PROCEDURE

ReturnValue          BYTE,AUTO

Looped BYTE
  CODE
  LOOP                                                     ! This method receives all window specific events
    IF Looped
      RETURN Level:Notify
    ELSE
      Looped = 1
    END
  ReturnValue = PARENT.TakeWindowEvent()
    CASE EVENT()
    OF EVENT:OpenWindow
         PDFViewerCOM_Ctrl = ?UltimateCOM
         PDFViewerCOM_Ctrl{PROP:Create}  = 'PDFViewerCOM.PDFViewerCOMControl'
         PDFViewerCOM.SetUCPostEvent(PDFViewerCOM_Event)
         PDFViewerCOM.RegisterEventFunc(PDFViewerCOM_Ctrl)
    END
    RETURN ReturnValue
  END
  ReturnValue = Level:Fatal
  RETURN ReturnValue

!----------------------------------------------------
csResize.Fetch   PROCEDURE (STRING Sect,STRING Ent,*? Val)
  CODE
  INIMgr.Fetch(Sect,Ent,Val)
  PARENT.Fetch (Sect,Ent,Val)
!----------------------------------------------------
csResize.Update   PROCEDURE (STRING Sect,STRING Ent,STRING Val)
  CODE
  INIMgr.Update(Sect,Ent,Val)
  PARENT.Update (Sect,Ent,Val)
!----------------------------------------------------
csResize.Init   PROCEDURE ()
  CODE
  PARENT.Init ()
  Self.CornerStyle = Ras:CornerDots
  SELF.GrabCornerLines() !
  SELF.SetStrategy(?OkButton,100,100,0,0)
  SELF.SetStrategy(?CancelButton,100,100,0,0)
  SELF.SetStrategy(?LookupFile,100,100,0,0)
!------------------------------------------------------------------------------------    
UCProcessCOMEvents_PDFViewerCOM PROCEDURE()
!------------------------------------------------------------------------------------
             
  CODE
   IF ~PDFViewerCOM.GetEvent();RETURN.
   ud.debug('At UCProcessCOMEvents_PDFViewerCOM')
   ud.debug('Event: ' & PDFViewerCOM.EventName)
   ud.debug('Parm1: ' & PDFViewerCOM.Parm1.GetValue())
   ud.debug('Parm2: ' & PDFViewerCOM.Parm2.GetValue())
   ud.debug('Parm3: ' & PDFViewerCOM.Parm3.GetValue())
   ud.debug('Parm4: ' & PDFViewerCOM.Parm4.GetValue())
   ud.debug('Parm5: ' & PDFViewerCOM.Parm5.GetValue())
   ud.debug('Parm6: ' & PDFViewerCOM.Parm6.GetValue())
 CASE PDFViewerCOM.EventName
 OF 'ControlReady'
     
      ud.Debug ('---- ControlReady ok---')
!      PDFViewerCOM{'LoadFile(D:\CarpioC12\EXAMPLES\School\sample.pdf)'}
 OF 'ErrorOccurred'
     
    ud.Debug(' === error=' & clip(PDFViewerCOM{'GetLastError()'}))
 OF 'NavigationCompleted'
     
 OF 'NavigationStarting'
     
 OF 'DocumentLoaded'
     
 OF 'PageChanged'
     
 OF 'ZoomChanged'
     
 OF 'SearchCompleted'
     
 OF 'AnnotationAdded'
     
 OF 'AnnotationSelected'
     
 OF 'BookmarkClicked'
     
 OF 'ThumbnailClicked'
     
 OF 'TextSelected'
     
 OF 'LinkClicked'
     
 OF 'PrintCompleted'
     
 OF 'ViewerReady'
     
    ?LookupFile{PROP:Disable} = False
    ?PdfName   {PROP:Disable} = FALSE
     ud.Debug (' --- ViewerReady se desio ---')
 END
