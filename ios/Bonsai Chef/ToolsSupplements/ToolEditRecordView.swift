//
//  ToolEditRecordView.swift
//  Bonsai Chef
//
//  Created by Nakya Tagli on 17.06.2024.
//

import SwiftUI
import PhotosUI

struct EditToolsSupplementView: View {
    @EnvironmentObject var toolsSupplementsData: ToolsSupplementsData
    @State private var editedToolName: String
    @State private var editedType: ToolSupplementType
    @State private var editedToolData1: String
    @State private var editedToolData2: String
    @State private var editedToolData3: String
    @State private var editedToolData4: String
    @State private var editedToolDetails: String
    @State private var editedPhotos: [UIImage] = []
    @State private var showImagePicker = false
    @Environment(\.presentationMode) var presentationMode
    
    var record: ToolsSupplementsRecord
    var onEditFinished: () -> Void
    
    init(record: ToolsSupplementsRecord, onEditFinished: @escaping () -> Void) {
        self.record = record
        self.onEditFinished = onEditFinished
        _editedToolName = State(initialValue: record.toolName)
        _editedType = State(initialValue: record.type)
        _editedToolData1 = State(initialValue: record.toolData1)
        _editedToolData2 = State(initialValue: record.toolData2)
        _editedToolData3 = State(initialValue: record.toolData3)
        _editedToolData4 = State(initialValue: record.toolData4)
        _editedToolDetails = State(initialValue: record.toolDetails)
        _editedPhotos = State(initialValue: record.toolPhotoPaths.compactMap { loadImageFromDocumentDirectory($0) })
    }
    
    var body: some View {
            NavigationView {
                Form {
                    Section {
                        TextField("Nome", text: $editedToolName)
                        Picker("Tipologia", selection: $editedType) {
                            ForEach(ToolSupplementType.allCases, id: \.self) { type in
                                Text(type.rawValue)
                            }
                        }
                        .pickerStyle(SegmentedPickerStyle())
                    }
                    TextField("Genere", text: $editedToolData1)
                    TextField("Venditore", text: $editedToolData2)
                    TextField("Prezzo", text: $editedToolData3)
                    Section(header: Text("Links")) {
                        TextEditor(text: $editedToolData4)
                    }
                    Section(header: Text("Dettagli")) {
                        TextEditor(text: $editedToolDetails)
                    }
                
                Section(header: Text("Fotos")) {
                    HStack {
                        Text("Fotos:")
                        Spacer()
                        Button("Aggiungi Foto") {
                            showImagePicker = true
                        }
                        .sheet(isPresented: $showImagePicker) {
                            ImagePicker(selectedImages: $editedPhotos)
                        }
                    }
                    ForEach(editedPhotos.indices, id: \.self) { index in
                        Image(uiImage: editedPhotos[index])
                            .resizable()
                            .scaledToFit()
                            .frame(height: 100)
                            .onTapGesture {
                                editedPhotos.remove(at: index)
                            }
                    }
                }
                
                Section {
                    Button("Salva Modifiche") {
                        saveChanges()
                    }
                }
            }
            .navigationTitle("Modifica Strumento")
            .navigationBarItems(trailing: Button("Annulla") {
                presentationMode.wrappedValue.dismiss()
            })
        }
    }
    
    func saveChanges() {
        let photoPaths = editedPhotos.compactMap { saveImageToDocumentDirectory($0) }
        
        record.toolName = editedToolName
        record.type = editedType
        record.toolData1 = editedToolData1
        record.toolData2 = editedToolData2
        record.toolData3 = editedToolData3
        record.toolData4 = editedToolData4
        record.toolDetails = editedToolDetails
        record.toolPhotoPaths = photoPaths
        
        toolsSupplementsData.updateRecord(record)
        onEditFinished()
        presentationMode.wrappedValue.dismiss()
    }
    
    private func saveImageToDocumentDirectory(_ image: UIImage) -> String? {
            guard let data = image.jpegData(compressionQuality: 0.8) else { return nil }
            let fileName = UUID().uuidString + ".jpeg"
            let fileURL = getDocumentsDirectory().appendingPathComponent(fileName)
            do {
                try data.write(to: fileURL)
                return fileName
            } catch {
                print("Error saving image: \(error.localizedDescription)")
                return nil
            }
        }
        
        private func loadImageFromDocumentDirectory(_ fileName: String) -> UIImage? {
            let fileURL = getDocumentsDirectory().appendingPathComponent(fileName)
            guard let data = try? Data(contentsOf: fileURL) else { return nil }
            return UIImage(data: data)
        }
        
        private func getDocumentsDirectory() -> URL {
            return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        }
    }

